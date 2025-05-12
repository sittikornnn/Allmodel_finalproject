from flask import Flask, request, jsonify
from flask_cors import CORS
import psycopg2
from psycopg2.extras import RealDictCursor
from werkzeug.security import generate_password_hash, check_password_hash
from pythainlp.util import Trie
import torch
from pythainlp.tokenize import word_tokenize
from sentence_transformers import SentenceTransformer, util
from datetime import datetime
import os
from pydub import AudioSegment
from transformers import AutoProcessor, AutoModelForSpeechSeq2Seq
import librosa
import base64
from transformers import VitsTokenizer, VitsModel, set_seed, AutoTokenizer, AutoModelForCausalLM, pipeline
import sounddevice as sd
from scipy.io.wavfile import read
import scipy
from collections import defaultdict
from peft import PeftModel

app = Flask(__name__)
CORS(app, supports_credentials=True)

UPLOAD_FOLDER = os.path.join(os.getcwd(), 'audio')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

id_user = 0
gender = 0
selection_situ = 1
checklist = []
topic = []
score = []
topic_request = []
tag_topic = []
threshold = 0.6
recording = []
matched_topics = {-1} # Track matched topics to avoid duplicate scoring
checklist_status = [] # Track whether each checklist item is matched
all_miss = dict()
count = 0
questions = []
normalAnswer = []
get_id_checklist = []

BASE_MODEL_ID = "biodatlab/whisper-th-medium-combined" # <-- *** แก้ไขให้ตรงกับ Base Model ของคุณ ***
LORA_CHECKPOINT_PATH = "./ASR/checkpoint-100" # <-- *** แก้ไข Path นี้ให้ถูกต้อง ***

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
TORCH_DTYPE = torch.float16 if torch.cuda.is_available() else torch.float32
SAMPLING_RATE = 16000
RECORD_SECONDS = 5

processor = None
model = None

model_respone = None
tokenizer_respone = None

def try_load_model():
    global processor , model, DEVICE
    try:
        
        # 3. โหลด Processor จาก Base Model ID
        print(f"กำลังโหลด Processor จาก Base Model: {BASE_MODEL_ID}")
        processor = AutoProcessor.from_pretrained(BASE_MODEL_ID)

        # 4. โหลด Base Model ตัวเต็ม
        print(f"กำลังโหลด Base Model: {BASE_MODEL_ID}")
        base_model = AutoModelForSpeechSeq2Seq.from_pretrained(
            BASE_MODEL_ID,
            torch_dtype=TORCH_DTYPE,
            low_cpu_mem_usage=True,
            # use_safetensors=True # ลองเปิดถ้า Base Model มี .safetensors
        )
        # ไม่ต้องย้าย base_model ไป device ก่อนโหลด PEFT

        # 5. โหลด LoRA Adapter และรวมเข้ากับ Base Model
        print(f"กำลังโหลด LoRA Adapter จาก: {LORA_CHECKPOINT_PATH} และรวมกับ Base Model...")
        model = PeftModel.from_pretrained(base_model, LORA_CHECKPOINT_PATH)
        print("โหลดและรวม LoRA Adapter สำเร็จ")

        # 6. (แนะนำ) Merge LoRA weights เข้าไปในโมเดลหลักเพื่อเร่งความเร็ว Inference
        print("กำลัง Merge LoRA weights เข้ากับ Base Model...")
        model = model.merge_and_unload()
        print("Merge สำเร็จ")
        # 7. ย้ายโมเดลสุดท้ายไป Device
        model.to(DEVICE)
        print(f"โหลด Model (Base+LoRA) และ Processor สำเร็จ (ใช้ Device: {DEVICE})")
        print("="*30)

    except Exception as e:
        print(f"เกิดข้อผิดพลาดในการโหลด Model หรือ Processor: {e}")
        print("กรุณาตรวจสอบว่า:")
        print(f"  - Base Model ID '{BASE_MODEL_ID}' ถูกต้องและมีอยู่บน Hugging Face Hub หรือไม่")
        print(f"  - Path ของ LoRA Checkpoint '{LORA_CHECKPOINT_PATH}' ถูกต้องหรือไม่")
        print(f"  - ไฟล์ adapter (เช่น adapter_model.bin, adapter_config.json) อยู่ใน Path ของ LoRA Checkpoint หรือไม่")
        print(f"  - ติดตั้งไลบรารี transformers, torch, accelerate, peft, sounddevice, numpy ครบถ้วนหรือไม่")
        import traceback
        traceback.print_exc() # พิมพ์รายละเอียด Error เพิ่มเติม
        processor = None
        model = None
        print("="*30)

def load_model_respone(gender):
    global model_respone,tokenizer_respone
    if gender == 0:
        model_respone = AutoModelForCausalLM.from_pretrained("./LLM/Male")
        tokenizer_respone = AutoTokenizer.from_pretrained("./LLM/Male")
    else:
        model_respone = AutoModelForCausalLM.from_pretrained("./LLM/Female")
        tokenizer_respone = AutoTokenizer.from_pretrained("./LLM/Female")

# Connect to PostgreSQL
def get_db_connection():
    return psycopg2.connect(
        dbname='ScoringT',
        user='postgres',
        password='123456789',
        host='localhost',
        cursor_factory=RealDictCursor
    )

def get_data(selection_situ):
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute('SELECT cl."ID_checklist",check_sent,score,prerequired,topic,tag_topic FROM "having" h,situation s,checklist cl where h."ID_situ" = s."ID_situ" and cl."ID_checklist" = h."ID_checklist" and s."ID_situ"=%s order by cl.topic,cl."ID_checklist"',(selection_situ,))
    processing = cursor.fetchall()
    cursor.close()
    conn.close()
    return processing

def get_name_patient(selection_situ):
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute('SELECT * FROM situation s where s."ID_situ"=%s',(selection_situ,))
    processing = cursor.fetchall()
    cursor.close()
    conn.close()
    return processing

def get_name_user(username):
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute('SELECT fname_user,lname_user FROM users WHERE "ID_user" = %s', (username,))
    processing = cursor.fetchall()
    cursor.close()
    conn.close()
    return processing

def get_custom_words(selection_situ):
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute('SELECT sem_word_token FROM public.semantic_token_situ sts where sts."ID_situ"=%s',(selection_situ,))
    processing = cursor.fetchall()
    processing = [row['sem_word_token'] for row in processing]
    cursor.close()
    conn.close()
    return processing

def get_new_words(selection_situ):
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute('SELECT word_token FROM public.token_situ ts where ts."ID_situ"=%s',(selection_situ,))
    processing = cursor.fetchall()
    processing = [row['word_token'] for row in processing]
    cursor.close()
    conn.close()
    return processing

@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    firstname = data.get('firstname')
    lastname = data.get('lastname')
    username = data.get('username')
    password = data.get('password')
    role = data.get('role')
    hashed_pw = generate_password_hash(password)

    if not all([firstname, lastname, username, password, role]):
        return jsonify({"message": "All fields are required"}), 400

    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO users (fname_user, lname_user, "ID_user", pw_user, role_user,hash_pw_user)
            VALUES (%s, %s, %s, %s, %s,%s)
        """, (firstname, lastname, username, password, role,hashed_pw))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"message": "User registered successfully"}), 201
    except Exception as e:
        print(e)
        return jsonify({"message": "Registration failed"}), 500

@app.route('/check_auth', methods=['GET'])
def check_auth():
    global id_user
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('SELECT * FROM users WHERE "ID_user" = %s', (id_user,))
    user = cur.fetchone()
    cur.close()
    conn.close()

    return jsonify({
        'role': user['role_user'],
        'id_user': user['ID_user'],
        'name_user': user['fname_user']+' '+user['lname_user'],
    }), 200

# Login user
@app.route('/login', methods=['POST'])
def login():
    global id_user
    data = request.get_json()
    username = data.get('username')
    password = str(data.get('password'))

    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('SELECT * FROM users WHERE "ID_user" = %s', (username,))
        user = cur.fetchone()
        cur.close()
        conn.close()

        if user and check_password_hash(user['hash_pw_user'], password):
            id_user = user["ID_user"]
            
            return jsonify({
                        "message": "Login successful",
                        "role": user['role_user'],
                    }), 200
        else:
            return jsonify({"message": "Invalid username or password"}), 401

    except Exception as e:
        print(e)
        return jsonify({"message": "Login failed"}), 500

@app.route('/logout', methods=['POST'])
def logout():
    global id_user
    id_user = 0
    return jsonify({"message": "Logged out successfully"}), 200
    
@app.route('/items')
def get_items():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('SELECT "ID_situ", name_situ FROM situation ORDER BY "ID_situ" ASC')
        items = cur.fetchall()
        cur.close()
        conn.close()
        return jsonify(items), 200
    except Exception as e:
        print(e)
        return jsonify({"message": "Error fetching items"}), 500
    
@app.route('/setup_data/<ID_situ>', methods=['GET'])
def setup_data(ID_situ):
    global checklist, topic, score, topic_request, selection_situ,checklist_status,id_user,count,matched_topics,normalAnswer,questions,get_id_checklist,gender,tag_topic
    normalAnswer = []
    questions = []
    get_id_checklist = []
    count = 0
    matched_topics = {-1}
    selection_situ = ID_situ
    data = get_data(ID_situ)
    get_id_checklist = [item["ID_checklist"] for item in data]
    checklist = [item['check_sent'] for item in data]
    topic = [item['topic'] for item in data]
    score = [item['score'] for item in data]
    topic_request = [item['prerequired'] for item in data]
    tag_topic = [item['tag_topic'] for item in data]

    name_patient = get_name_patient(ID_situ)
    #ชาย = 0 หญิง 1
    gender = [0 if item['gender_patient'] == 'ชาย' else 1 for item in name_patient]
    fname_patient = [item['fname_patient'] for item in name_patient]
    lname_patient = [item['lname_patient'] for item in name_patient]
    p_fname = checklist[2].split('fname')
    p_fname.insert(1,fname_patient[0])
    checklist[2] = ''.join(p_fname)
    p_full = checklist[3].split('fullname')
    p_full.insert(1,fname_patient[0])
    p_full.insert(2,lname_patient[0])
    checklist[3] = ''.join(p_full)
    topic_testing = [item['name_situ'] for item in name_patient][0]
    image_data = [item['image'] for item in name_patient][0]
    if isinstance(image_data, memoryview):
        image_data = image_data.tobytes()  # Convert memoryview to bytes
    image_testing = base64.b64encode(image_data).decode('utf-8')  # Convert bytes to base64 string

    std_name =  get_name_user(id_user)
    fname_user = [item['fname_user'] for item in std_name]
    lname_user = [item['lname_user'] for item in std_name]
    fullname_std = fname_user[0]+lname_user[0]
    checklist[0] = checklist[0]+fullname_std

    checklist_status = [False] * len(checklist)
    
    questions.append(checklist[1])
    normalAnswer.append(fname_patient[0]+lname_patient[0])
    questions.append(checklist[2])
    normalAnswer.append(lname_patient[0])
    yesno_gender_name = [item['repeat_name'] for item in name_patient]
    questions.append(checklist[3])
    normalAnswer.append(yesno_gender_name[0])
    if checklist[4] == 'ผู้ป่วยมีประวัติแพ้ยาอะไรไหม':
        questions.append(checklist[4])
        allergy = [item['allergy'] for item in name_patient]
        normalAnswer.append(allergy[0])
    if checklist[5] == 'ผู้ป่วยแพ้ยามีอาการผื่นคันใช่ไหม':
        questions.append(checklist[5])
        allergy_des = [item['allergy_des'] for item in name_patient]
        normalAnswer.append(allergy_des[0])
    if checklist[5] == 'ผู้ป่วยมีโรคประจำตัวอะไรไหม':
        questions.append(checklist[5])
        chronic = [item['chronic'] for item in name_patient]
        normalAnswer.append(chronic[0])
    print(questions)
    print(normalAnswer)

    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute('''
        INSERT INTO public.result_test(
            date_test, score_test, "ID_user", "ID_situ"
        ) VALUES (%s, %s, %s, %s);
    ''', (datetime.now(), 0, id_user, ID_situ))

    conn.commit()  # <--- commit is important after INSERT

    cur.close()
    conn.close()

    try_load_model()
    load_model_respone(gender[0])

    return jsonify({
        "message": f"setup data with ID_situ = {ID_situ}",
        "topic": topic_testing,
        "image": image_testing
    }), 200

def token_sentence(sentence,ID_situ):
    torch.cuda.empty_cache()
    torch.cuda.ipc_collect()

    custom_words = get_custom_words(ID_situ)
    new_words = get_new_words(ID_situ)
    trie = Trie(new_words)

    # โหลดโมเดล
    model = SentenceTransformer("token_model")

    words_to_delete = {
        "อืม", "อ่า", "เอ่อ", "อือ", "เอ้อ", "แบบ", "ไง", "มั้ง","เออ",
        "งั้น", "ก็", "อ่ะ", "เหรอ", "นะ", "น่ะ", "ล่ะ", "แหละ", "หรอก",
        "หรือยัง", "ใช่มั้ย", "ไหม", "มั้ย", "แฮะ", "อุ๊ย", "ว้าว", "อ้าว", "เฮ้ย",
        "อ๊ะ", "อิอิ", "555", "เอะ", "เอิ่ม", "โอ้", "โอ๊ะ", "หืม", "โธ่", "จ๊ะ", "จ้ะ", "เจ๊า","นะ","เนี่ย",
        }  # คำที่ต้องการลบ

    # ตัดคำ
    token_basic_words = word_tokenize(sentence, keep_whitespace=False)

    # ลบคำที่อยู่ใน words_to_delete
    filtered_words = [word for word in token_basic_words if word not in words_to_delete]

    # รวมคำกลับเป็นประโยค
    new_sentence = ''.join(filtered_words)

    # ตัดคำประโยค
    words = word_tokenize(new_sentence,keep_whitespace=False,custom_dict=trie)

    # คำนวณความคล้ายคลึงของแต่ละคำในประโยคกับ custom_words
    sentence_embeddings = model.encode(words)
    custom_embeddings = model.encode(custom_words)

    # ตรวจหาคำที่มี similarity สูงกับ custom_words
    split_positions = []
    for i, word_embedding in enumerate(sentence_embeddings):
        similarity = util.cos_sim(word_embedding, custom_embeddings).argmax().item()
        similarities = util.cos_sim(word_embedding, custom_embeddings)  # คำนวณ similarity matrix
        max_index = similarities.argmax().item()
        
        if similarities[0][max_index].item() > 0.6:  # เช็ค threshold
            split_positions.append(i)

    # แบ่งประโยคตามตำแหน่งที่พบ
    split_sentences = []
    prev_idx = 0
    for idx in split_positions:
        if idx != 0:
            split_sentences.append("".join(words[prev_idx:idx]))
            prev_idx = idx
    split_sentences.append("".join(words[prev_idx:]))

    return split_sentences

def genAnswer(index):
    global normalAnswer
    return normalAnswer[index]
        
def model_bird(text):
    global model_respone,tokenizer_respone
    print(text)
    pipe = pipeline(
        "text-generation",
        model=model_respone,
        tokenizer=tokenizer_respone,
        device_map="auto"
    )

    messages = [{"role": "user", "content": f"{text}"}]
    outputs = pipe(messages, max_new_tokens=128)
    response = outputs[0]["generated_text"][-1]
    if isinstance(response, dict) and "content" in response:
        return response["content"]
    elif isinstance(response, dict):
        return str(response.get("content", ""))
    return str(response)
    

def TTS(response):
    tokenizer = VitsTokenizer.from_pretrained("VIZINTZOR/MMS-TTS-THAI-MALEV2",cache_dir="./mms")
    model = VitsModel.from_pretrained("VIZINTZOR/MMS-TTS-THAI-MALEV2",cache_dir="./mms")

    inputs = tokenizer(text=response, return_tensors="pt")

    set_seed(456)  # make deterministic

    with torch.no_grad():
        outputs = model(**inputs)

    waveform = outputs.waveform[0]

    # Convert PyTorch tensor to NumPy array
    waveform_array = waveform.numpy()

    scipy.io.wavfile.write("techno_output.wav", rate=model.config.sampling_rate, data=waveform_array)

    # Read the .wav file
    sample_rate, data = read("./techno_output.wav")

    # Play the audio
    sd.play(data, samplerate=sample_rate)
    sd.wait()  # Wait until playback is finished

def model_scoring(split_sentences):
    global checklist,topic,topic_request,score,count,matched_topics,checklist_status,questions
    torch.cuda.empty_cache()
    torch.cuda.ipc_collect()
    respone = ''
    old_state = checklist_status.copy()
    model = SentenceTransformer('trained_model')

    count += 0
    
    # Encode the checklist sentences
    checklit_embeddings = model.encode(checklist)

    # Iterate through split_sent and check for similarity
    for doublecheck in range(2):
        print(doublecheck)
        print(type(doublecheck))
        if doublecheck == 1:
            print("doublecheck is 1")
        else:
            print("doublecheck is 0")
        for sent in split_sentences:
            sent_embedding = model.encode(sent)
            similarities = util.cos_sim(sent_embedding, checklit_embeddings)

            for i, check in enumerate(checklist):
                if similarities[0][i] > threshold:
                    best_match_index = i
                    matched_checklist_item = checklist[best_match_index]
                    matched_topic = topic[best_match_index]
                    matched_score = score[best_match_index]
                    required_topic = topic_request[best_match_index]

                    # Ensure dependencies are met
                    if required_topic != -1 and required_topic not in matched_topics:
                        continue  # Skip if required topic was not mentioned first

                    # Add score only if the topic has not been counted before
                    if matched_topic not in matched_topics:
                        checklist_status[best_match_index] = True  # Mark as matched
                        count = count + matched_score
                        matched_topics.add(matched_topic)
                       
                    if (matched_checklist_item in questions) and (doublecheck == 1) and checklist_status[best_match_index]:
                        print('work function genAns')
                        index = questions.index(matched_checklist_item)
                        respone = genAnswer(index)
                        print(respone)
                        TTS(respone)

    if old_state == checklist_status:
        respone = model_bird(sent)
        print(respone)
        TTS(respone)

    print("Checklist Status:")
    for i,check in enumerate(checklist):
        print(check,":",checklist_status[i])
    print("Total Score:", count)

    return respone

def convert_to_wav(input_file, output_file="converted.wav"):
    audio = AudioSegment.from_file(input_file)
    audio = audio.set_channels(1).set_frame_rate(16000).set_sample_width(2)  # PCM 16-bit Mono
    audio.export(output_file, format="wav")
    return output_file

def split_audio(audio, sr, max_length_sec=15):
    max_samples = sr * max_length_sec
    return [audio[i:i + max_samples] for i in range(0, len(audio), max_samples)]

def ASR(input_file):
    global DEVICE, SAMPLING_RATE, processor, model

    print(f"🔊 Processing audio file: {input_file}")

    try:
        audio_input, sr = librosa.load(input_file, sr=SAMPLING_RATE)
        print(f"✅ Loaded audio | Shape: {audio_input.shape}, Sample Rate: {sr}")
    except Exception as e:
        print(f"❌ Error loading audio file: {e}")
        return ""

    audio_chunks = split_audio(audio_input, sr=SAMPLING_RATE)
    print(f"🔍 Number of audio chunks: {len(audio_chunks)}")

    transcriptions = []

    for i, chunk in enumerate(audio_chunks):
        print(f"🎧 Processing chunk {i + 1}/{len(audio_chunks)} | Shape: {chunk.shape}")

        try:
            input_features = processor(
                chunk, sampling_rate=SAMPLING_RATE, return_tensors="pt"
            ).input_features.to(DEVICE)

            input_features = input_features.to(dtype=next(model.parameters()).dtype)

            # with torch.no_grad():
            #     predicted_ids = model.generate(input_features)
            #     transcription = processor.batch_decode(
            #         predicted_ids, skip_special_tokens=True
            #     )[0]
            #     transcriptions.append(transcription)
            forced_decoder_ids = processor.get_decoder_prompt_ids(language="th",task="transcribe")
            predicted_ids = model.generate(input_features,max_new_tokens=300,forced_decoder_ids=forced_decoder_ids)

            transcription = processor.batch_decode(predicted_ids,skip_special_tokens=True)[0]

            transcriptions.append(transcription)

        except Exception as e:
            print(f"⚠️ Error processing chunk {i}: {e}")
            transcriptions.append("[Unintelligible]")  # fallback text

    full_transcription = " ".join(transcriptions).strip()
    print(f"📝 Final Transcription: {full_transcription[:100]}...")  # print first 100 chars
    return full_transcription
    
@app.route('/send_data', methods=['POST'])
def send_data():
    global checklist_status,get_id_checklist
    if 'audio' not in request.files:
        return jsonify({"error": "No audio file provided"}), 400

    audio = request.files['audio']
    file_name = audio.filename
    file_path = os.path.join(UPLOAD_FOLDER, file_name)

    # Save the uploaded audio file
    audio.save(file_path)

    wav_file = convert_to_wav(file_path)

    # Process the uploaded audio file with ASR
    transcription = ASR(wav_file)
    
    ID_situ = request.form.get('ID_situ')
    
    temp_state = checklist_status.copy()

    split_sentences = token_sentence(transcription,ID_situ)
    respone_system = model_scoring(split_sentences)

    new_checked_indices = [
        i for i, (before, after) in enumerate(zip(temp_state, checklist_status)) if not before and after
    ]

    check_system = [get_id_checklist[i] for i in new_checked_indices]

    if not check_system:
        check_system.append(447)

    for sy in check_system:

        # Save data into database
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)  # Ensure you're using RealDictCursor

        # Step 1: Get latest ID_test
        cur.execute('''
            SELECT "ID_test" FROM public.result_test
            ORDER BY "ID_test" DESC
            LIMIT 1
        ''')

        latest_id_test = cur.fetchone()

        print(latest_id_test)

        if latest_id_test:
            latest_id_test = latest_id_test['ID_test']  # Fix: extract integer value

            # Step 2: Insert into verify_result
            cur.execute('''
                INSERT INTO public.verify_result (
                    get_sent, "ID_test", "ID_checklist"
                ) VALUES (%s, %s, %s)
            ''', (transcription, latest_id_test, sy))

            conn.commit()

        cur.close()
        conn.close()

    return jsonify({"message": transcription,"res_system":respone_system}), 200

@app.route('/submit_testing', methods=['GET'])
def submit_testing():
    global checklist, topic_request, score, count, checklist_status,all_miss,tag_topic
    miss_text = []
    find_drug = []
    name_drug = []

    for i, clst in enumerate(checklist_status):
        if (not clst) and (score[i] == 0 or tag_topic[i] == 4):
            print(checklist[i], topic_request[i])
            miss_text.append(checklist[i])
            find_drug.append(topic_request[i])

    for fd in find_drug:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute(
            'SELECT check_sent FROM "having" h, situation s, checklist cl '
            'WHERE h."ID_situ" = s."ID_situ" AND cl."ID_checklist" = h."ID_checklist" '
            'AND s."ID_situ"=%s AND topic=%s '
            'ORDER BY cl.topic, cl."ID_checklist"',
            (selection_situ, fd)
        )
        processing = cursor.fetchall()
        cursor.close()
        conn.close()

        check_sent = [item['check_sent'] for item in processing]
        name_drug.append(check_sent)

    # Combine miss_text and name_drug into a dictionary
    all_miss = dict(zip(miss_text, name_drug))

    print(all_miss)

    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute('''
        SELECT "ID_test" FROM public.result_test
        ORDER BY "ID_test" DESC
        LIMIT 1
    ''')

    latest_id_test = cur.fetchone()
    if latest_id_test:
        latest_id_test = latest_id_test['ID_test']

        # Now update the score_test correctly
        cur.execute('''
            UPDATE public.result_test
            SET score_test = %s
            WHERE "ID_test" = %s;
        ''', (count, latest_id_test))

        conn.commit()  # Important after UPDATE

    cur.close()
    conn.close()

    return jsonify({
        "message": "Submit Successfully!",
        "total_score": count,
    }), 200

@app.route('/all_miss',methods=['GET'])
def all_miss_about_drug():
    global all_miss
    return jsonify({"message": "text miss", "textmiss": all_miss}), 200
    
@app.route('/api/history', methods=['GET'])
def get_history():
    global id_user
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        query = """
            SELECT date_test, score_test, name_situ 
            FROM result_test rt
            JOIN situation s ON rt."ID_situ" = s."ID_situ"
            where rt."ID_user" = %s
            ORDER BY rt."ID_test" DESC;
        """
        cur.execute(query, (id_user,))
        rows = cur.fetchall()

        cur.close()
        conn.close()

        return jsonify(rows)

    except Exception as e:
        print("Error fetching history:", e)
        return jsonify({'error': 'Internal server error'}), 500
    
@app.route('/api/check_history', methods=['GET'])
def get_check_history():
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        query = """
            SELECT rt."ID_test",u."ID_user",fname_user,lname_user,name_situ,date_test,score_test FROM users u,result_test rt,situation s
            where rt."ID_situ" = s."ID_situ" and u."ID_user" = rt."ID_user"
            ORDER BY "date_test" desc
        """
        cur.execute(query,)
        rows = cur.fetchall()

        cur.close()
        conn.close()

        return jsonify(rows)

    except Exception as e:
        print("Error fetching history:", e)
        return jsonify({'error': 'Internal server error'}), 500
    
@app.route('/api/history_conversation/<int:id_test>', methods=['GET'])
def get_history_conversation(id_test):
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    query = """
        SELECT get_sent AS sentence, score AS scoring, check_sent
        FROM verify_result vr
        JOIN checklist cl ON vr."ID_checklist" = cl."ID_checklist"
        JOIN result_test rt ON rt."ID_test" = vr."ID_test"
        WHERE rt."ID_test" = %s
        ORDER BY vr."ID_verify" ASC;
    """
    cursor.execute(query, (id_test,))
    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    grouped = defaultdict(lambda: {"scoring": [], "check_sent": []})
    for row in rows:
        sentence = row["sentence"]
        grouped[sentence]["scoring"].append(row["scoring"])
        grouped[sentence]["check_sent"].append(row["check_sent"])

    # Convert to list of dicts with sentence as key
    results = [{"sentence": k, "scoring": v["scoring"], "check_sent": v["check_sent"]}
               for k, v in grouped.items()]

    return jsonify(results)
    
@app.route('/best_score/<int:ID_situ>', methods=['GET'])
def best_score_situ(ID_situ):
    global id_user

    if not id_user:
        return jsonify({'message': 'User not authenticated'}), 401
    
    try:
        # Get a connection to the database
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        # Query to get the best score for a given situation ID (ID_situ)
        query = """
            SELECT MAX(rt.score_test) AS top_score
            FROM result_test rt
            JOIN situation s ON rt."ID_situ" = s."ID_situ"
            WHERE rt."ID_situ" = %s and rt."ID_user" = %s;
        """
        cur.execute(query, (ID_situ,id_user,))
        top_score = cur.fetchone()  # Fetch the best score

        # Close the cursor and connection
        cur.close()
        conn.close()

        # Check if the top_score exists
        if top_score and top_score['top_score'] is not None:
            return jsonify({'score': top_score['top_score']}), 200
        else:
            return jsonify({'message': 'No scores found for this situation'}), 404

    except Exception as e:
        # Handle errors
        return jsonify({'message': str(e)}), 500
    
@app.route('/api/users', methods=['GET'])
def get_users():
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute('SELECT * FROM public.users ORDER BY "ID_user" desc;')
            users = cur.fetchall()
        return jsonify(users)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
@app.route('/api/users/<int:user_id>', methods=['PUT'])
def update_user(user_id):
    data = request.get_json()
    fname = data.get('fname_user')
    lname = data.get('lname_user')
    pw = data.get('pw_user')
    role = data.get('role_user')
    hashed_pw = generate_password_hash(pw)

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE users
        SET fname_user = %s, lname_user = %s, pw_user = %s, role_user = %s,hash_pw_user = %s
        WHERE "ID_user" = %s
    """, (fname, lname, pw, role, hashed_pw, user_id,))
    conn.commit()
    cursor.close()
    conn.close()
    return jsonify({'message': 'User updated'}), 200

# Delete user
@app.route('/api/users/<int:user_id>', methods=['DELETE'])
def delete_user(user_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM users WHERE "ID_user" = %s', (user_id,))
    conn.commit()
    cursor.close()
    conn.close()
    return jsonify({'message': 'User deleted'}), 200
    
if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001)