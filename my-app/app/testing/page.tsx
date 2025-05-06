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
  const [countSent, setCountSent] = useState(0);
  const [topic, setTopic] = useState("Welcome to MyApp");
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true); // ✅ Loading state
  const searchParams = useSearchParams();
  const ID_situ = searchParams.get("ID_situ");
  const [ID_user, setID_user] = useState<string | null>(null);
  const router = useRouter();

  // ✅ Fetch user ID
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

  // ✅ Fetch topic and image
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
        } finally {
          setLoading(false); // ✅ Stop loading when done
        }
      } else {
        setLoading(false);
      }
    };

    fetchData();
  }, [ID_situ]);

  // ✅ Submit exam
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

  // ✅ Upload audio
  const sendAudioToAPI = async (audioBlob: Blob) => {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.wav');
    formData.append('ID_situ', ID_situ || '');
    formData.append('ID_user', ID_user || '');

    try {
      const response = await fetch('http://localhost:5001/send_data', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        console.log(data.message);
        setReply(true);
        setCountSent((prev) => prev + 1);
      } else {
        console.error('Failed to upload audio.');
      }
    } catch (error) {
      console.error('Error while uploading audio:', error);
    }
  };

  // ✅ Toggle microphone
  const toggleMicrophone = async () => {
    if (!microphone) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;

        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;

        audioChunksRef.current = [];

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
      mediaStreamRef.current?.getTracks().forEach(track => track.stop());
      setMicrophone(false);
      setReply(false);
      console.log('Microphone stopped.');
    }
  };

  // ✅ Show full screen loader until setup_data is ready
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
        <Loader2 className="w-12 h-12 animate-spin text-blue-500 mb-4" />
        <p className="text-lg text-gray-600 font-semibold">Loading your test setup...</p>
      </div>
    );
  }

  // ✅ Main UI after loading
  return (
    <>
      <Navbar />
      <div className="flex flex-col items-center justify-center min-h-screen px-4 py-8 space-y-6">
        {/* Title and Submit Button */}
        <div className="w-full max-w-2xl flex justify-between items-center">
          <h1 className="text-2xl font-bold">{topic}</h1>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            className="bg-green-500 hover:bg-green-600 text-white rounded-lg"
          >
            Submit
          </Button>
        </div>

        {/* Image Preview */}
        {image && (
          <img
            src={`data:image/jpeg;base64,${image}`}
            alt="Situation"
            className="w-full max-w-2xl rounded shadow-md"
          />
        )}

        {/* Microphone Controls */}
        {reply ? (
          <div className="flex flex-col items-center space-y-3">
            {microphone && <p className="text-red-500 font-medium">🎤 Microphone is ON</p>}
            <Button
              variant="outline"
              onClick={toggleMicrophone}
              className="flex items-center gap-2 px-4 py-2 rounded-lg"
            >
              {microphone ? <Square className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              <span>{microphone ? "Stop" : "Start"}</span>
            </Button>
          </div>
        ) : (
          <Button disabled className="flex items-center gap-2">
            <Loader2 className="animate-spin w-5 h-5" />
            <span>Please wait</span>
          </Button>
        )}
      </div>
    </>
  );
}