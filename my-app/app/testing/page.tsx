'use client';
import { Play, Square, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Navbar from '@/components/Navbar';

export default function Home() {
  const [microphone, setMicrophone] = useState(false);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [reply, setReply] = useState(true);
  const searchParams = useSearchParams();
  const ID_situ = searchParams.get("ID_situ");
  const [ID_user, setID_user] = useState<string | null>(null);
  const [countSent, setCountSent] = useState(0);
  const [topic, setTopic] = useState("Welcome to MyApp");
  const [image, setImage] = useState<string | null>(null);
  const router = useRouter();

  // Fetch user ID (Commented for now)
  useEffect(() => {
    fetch('http://localhost:5001/check_auth', {
      credentials: 'include',
    })
      .then(res => {
        if (!res.ok) throw new Error('Not authenticated');
        return res.json();
      })
      .then(data => {
        setID_user(data.id_user);
      })
      .catch(err => {
        console.error(err);
      });
  }, []);

  // Fetch topic and image based on situation ID
  useEffect(() => {
    const fetchData = async () => {
      if (ID_situ) {
        try {
          const res = await fetch(`http://localhost:5001/setup_data/${ID_situ}`);
          if (res.ok) {
            const result = await res.json();
            setTopic(result.topic);
            setImage(result.image);
          } else {
            console.error("Failed to fetch setup data.");
          }
        } catch (err) {
          console.error("Error fetching setup data:", err);
        }
      }
    };

    fetchData();
  }, [ID_situ, ID_user]);

  // Handle submit button click
  const handleSubmit = async () => {
    if (countSent <= 0) {
      alert('You must send data at least once before submitting!');
      return;
    }

    const confirmation = window.confirm('Are you sure you want to submit this exam?');
    if (!confirmation) return;

    try {
      const res = await fetch('http://localhost:5001/submit_testing');
      if (res.ok) {
        const data = await res.json();
        router.push(`/temp_result?total_score=${data.total_score}`);
      } else {
        console.log('Request failed with status:', res.status);
        alert('Failed to submit the exam');
      }
    } catch (err) {
      console.error('Error submitting data:', err);
      alert('Error submitting data');
    }
  };

  // Upload audio to API
  const sendAudioToAPI = async (audioBlob: Blob) => {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.wav');

    try {
      const response = await fetch('http://127.0.0.1:5001/upload-audio', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        console.log(data.transcription);
        setReply(true);
        setCountSent((prev) => prev + 1);
      } else {
        console.error('Failed to upload audio.');
      }
    } catch (error) {
      console.error('Error while uploading audio:', error);
    }
  };

  // Toggle microphone state
  const toggleMicrophone = async () => {
    if (!microphone) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;

        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
          sendAudioToAPI(audioBlob);
          audioChunksRef.current = [];
        };

        mediaRecorder.start();
        setMicrophone(true);
        console.log('Microphone started.');
      } catch (error) {
        console.error('Error accessing microphone:', error);
      }
    } else {
      mediaRecorderRef.current?.stop();
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      setMicrophone(false);
      setReply(false);
      console.log('Microphone stopped.');
    }
  };

  return (
    <>
      <Navbar />
      <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
        {/* Title and Submit Button */}
        <div className="relative w-full flex justify-center items-center px-4 gap-6">
          <h1 className="text-2xl font-bold">{topic}</h1>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            className="rounded-lg bg-green-500 hover:bg-green-600 text-white"
          >
            <span>Submit</span>
          </Button>
        </div>

        {/* Show image from database */}
        {image && (
          <img
            src={`data:image/jpeg;base64,${image}`}
            alt="Detection"
            className="w-full max-w-2xl mx-auto rounded shadow-md"
          />
        )}

        {/* Microphone Toggle and Status */}
        {reply ? (
          <>
            {microphone && <p className="text-red-500">🎤 Microphone is ON</p>}
            <Button
              variant="outline"
              onClick={toggleMicrophone}
              className="flex items-center space-x-2 px-4 py-2 rounded-lg"
            >
              {microphone ? <Square className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              <span>{microphone ? "Stop" : "Start"}</span>
            </Button>
          </>
        ) : (
          <Button disabled className="flex items-center space-x-2">
            <Loader2 className="animate-spin w-5 h-5" />
            <span>Please wait</span>
          </Button>
        )}
      </div>
    </>
  );
}