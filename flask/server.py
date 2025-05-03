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
from transformers import WhisperForConditionalGeneration, WhisperProcessor
import librosa
import base64

app = Flask(__name__)
CORS(app, supports_credentials=True)

UPLOAD_FOLDER = os.path.join(os.getcwd(), 'audio')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

id_user = 0

selection_situ = 1
checklist = []
topic = []
score = []
topic_request = []
threshold = 0.6
recording = []
matched_topics = {-1} # Track matched topics to avoid duplicate scoring
checklist_status = [] # Track whether each checklist item is matched
all_miss = dict()
count = 0

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
    cursor.execute('SELECT check_sent,score,prerequired,topic FROM "having" h,situation s,checklist cl where h."ID_situ" = s."ID_situ" and cl."ID_checklist" = h."ID_checklist" and s."ID_situ"=%s order by cl.topic,cl."ID_checklist"',(selection_situ,))
    processing = cursor.fetchall()
    cursor.close()
    conn.close()
    return processing

def get_name_patient(selection_situ):
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute('SELECT fname_patient,lname_patient,name_situ,image FROM situation s where s."ID_situ"=%s',(selection_situ,))
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
    global checklist, topic, score, topic_request, selection_situ,checklist_status,id_user,count,matched_topics

    count = 0
    matched_topics = {-1}
    selection_situ = ID_situ
    data = get_data(ID_situ)
    checklist = [item['check_sent'] for item in data]
    topic = [item['topic'] for item in data]
    score = [item['score'] for item in data]
    topic_request = [item['prerequired'] for item in data]

    name_patient = get_name_patient(ID_situ)
    fname_patient = [item['fname_patient'] for item in name_patient]
    lname_patient = [item['lname_patient'] for item in name_patient]
    temp = checklist[2].split('fname')
    temp.insert(1,fname_patient[0])
    checklist[2] = ''.join(temp)
    temp = checklist[3].split('fullname')
    temp.insert(1,fname_patient[0])
    temp.insert(2,lname_patient[0])
    checklist[3] = ''.join(temp)
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

    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute('''
        INSERT INTO public.result_test(
            date_test, score_test, "ID_student", "ID_situ"
        ) VALUES (%s, %s, %s, %s);
    ''', (datetime.now(), 0, id_user, ID_situ))

    conn.commit()  # <--- commit is important after INSERT

    cur.close()
    conn.close()

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

def model_scoring(split_sentences):
    global checklist,topic,topic_request,score,count,matched_topics
    torch.cuda.empty_cache()
    torch.cuda.ipc_collect()

    model = SentenceTransformer('trained_model')

    count += 0
    
    # Encode the checklist sentences
    checklit_embeddings = model.encode(checklist)

    # Iterate through split_sent and check for similarity
    for doublecheck in range(0,2):
        for sent in split_sentences:
            sent_embedding = model.encode(sent)
            similarities = util.cos_sim(sent_embedding, checklit_embeddings)

            # best_match_index = similarities[0].argmax().item()  # Get index of highest similarity
            # best_score = similarities[0][best_match_index].item()

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

                    checklist_status[best_match_index] = True  # Mark as matched

                    # Add score only if the topic has not been counted before
                    if matched_topic not in matched_topics:
                        count = count + matched_score
                        matched_topics.add(matched_topic)

                    # if doublecheck > 0:
                    #     recording.append({
                    #     "checklist_item": matched_checklist_item,
                    #     "matched_sentence": sent,
                    #     "similarity_score": similarities[0][i],
                    #     "topic": matched_topic,
                    #     "score": matched_score
                    #     })

    print("Checklist Status:")
    for i,check in enumerate(checklist):
        print(check,":",checklist_status[i])
    print("Total Score:", count)

def convert_to_wav(input_file, output_file="converted.wav"):
    audio = AudioSegment.from_file(input_file)
    audio = audio.set_channels(1).set_frame_rate(16000).set_sample_width(2)  # PCM 16-bit Mono
    audio.export(output_file, format="wav")
    return output_file

def split_audio(audio, sr, max_length_sec=30):
    max_samples = sr * max_length_sec
    return [audio[i:i + max_samples] for i in range(0, len(audio), max_samples)]

def ASR(file_path):
    # Define model path
    model_path = "./whisper-monsoon-t1"

    # Load processor (tokenizer + feature extractor)
    processor = WhisperProcessor.from_pretrained(model_path)

    # Load model
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = WhisperForConditionalGeneration.from_pretrained(model_path).to(device)
    
    sr=16000
    # Load audio file
    audio_input, _ = librosa.load(file_path, sr=sr)  # Ensure 16kHz sample rate

    # Split audio into chunks
    audio_chunks = split_audio(audio_input, sr)
    
    transcriptions = []
    
    for chunk in audio_chunks:
        # Process the chunk to match model input requirements, 
        # include any generation parameters as needed (e.g., language)
        input_features = processor(chunk, sampling_rate=sr, return_tensors="pt").input_features.to(device)
        
        # Generate token IDs using the model
        with torch.no_grad():
            predicted_ids = model.generate(input_features)
        
        # Decode token IDs to text, skipping any special tokens
        transcription = processor.batch_decode(predicted_ids, skip_special_tokens=True)[0]
        transcriptions.append(transcription)
    
    # Combine transcriptions from all chunks (add a separator if needed)
    return "".join(transcriptions)
    
@app.route('/send_data', methods=['POST'])
def send_data():
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
    print(transcription)
    
    ID_situ = request.form.get('ID_situ')
    ID_user = request.form.get('ID_user')


    split_sentences = token_sentence(transcription,ID_situ)
    model_scoring(split_sentences)

    print(f"Received name: {split_sentences}, ID_situ: {ID_situ}, ID_user: {ID_user}")

    # Save data into database

    return jsonify({"message": transcription}), 200

@app.route('/submit_testing', methods=['GET'])
def submit_testing():
    global checklist, topic_request, score, count, checklist_status,all_miss
    miss_text = []
    find_drug = []
    name_drug = []

    for i, clst in enumerate(checklist_status):
        if (not clst) and score[i] == 0:
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

# @app.route('/reset_score', methods=['POST'])
# def reset_score():
#     global count,checklist
#     data = request.get_json()
    
#     if data and 'score' in data:
#         count = data['score']  # Reset score to the value passed in the request (e.g., 0)
#         # Reset all values to False
#         checklist = {key: False for key in checklist}
#         return jsonify({"message": "Score reset successful", "score": count}), 200
#     else:
#         return jsonify({"message": "Invalid data"}), 400
    
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
            where rt."ID_student" = %s
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
    
@app.route('/best_score/<int:ID_situ>', methods=['GET'])
def best_score_situ(ID_situ):
    global id_user
    try:
        # Get a connection to the database
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        # Query to get the best score for a given situation ID (ID_situ)
        query = """
            SELECT MAX(rt.score_test) AS top_score
            FROM result_test rt
            JOIN situation s ON rt."ID_situ" = s."ID_situ"
            WHERE rt."ID_situ" = %s and rt."ID_student" = %s;
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
    
if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001)