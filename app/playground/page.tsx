"use client";

import { useState, useEffect, useRef } from "react";
import ProfileCard from "../components/ProfileCard";
import TextEditor from "../components/TextEditor";
import ChatWindow from "../components/ChatWindow";
import RulesModal from "../components/RulesModal";
import { QUESTIONS } from '../components/questions';

interface Message {
  id: number;
  text: string;
  sender: "user" | "bot";
}

const Index = () => {
  const consecutiveSilenceCountRef = useRef(0);
  const silenceThreshold = 2;

  const isPlayingAudioRef = useRef(false);

  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<any>(null);

  const [showRules, setShowRules] = useState(true);
  const [showEndModal, setShowEndModal] = useState(false);
  const [interviewTimer, setInterviewTimer] = useState(10);

  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isResponding, setIsResponding] = useState(false);
  const [editorText, setEditorText] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, text: "Hey! How's the writing going?", sender: "bot" },
  ]);

  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksBuffer = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const difficulty = params.get('difficulty');
    if (difficulty && QUESTIONS[difficulty]) {
      setInterviewTimer(QUESTIONS[difficulty].timer);
    }
  }, []);

  useEffect(() => {
    if (!showRules) {
      initializeMicrophone();
    }
    return () => {
      cleanup();
    };
  }, [showRules]);

  const handleTimeUp = async () => {
    setShowEndModal(true);
    setIsEvaluating(true);
    cleanup();

    const conversationHistory = messages
      .map(m => `${m.sender === 'user' ? 'Candidate' : 'Interviewer'}: ${m.text}`)
      .join('\n\n');

    try {
      const response = await fetch('http://localhost:8080/api/interview/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationHistory })
      });
      const evaluation = await response.json();
      setEvaluationResult(evaluation);
    } catch (error) {
      console.error('Evaluation failed:', error);
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleEndInterview = () => {
    window.location.href = 'https://localhost:3001';
  };

  const detectSpeech = async (audioBlob: Blob): Promise<boolean> => {
    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      if (arrayBuffer.byteLength < 1000) return false;

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      const channelData = audioBuffer.getChannelData(0);

      let sum = 0;
      for (let i = 0; i < channelData.length; i++) {
        sum += channelData[i] * channelData[i];
      }
      const rms = Math.sqrt(sum / channelData.length);

      return rms > 0.0375;
    } catch {
      return true;
    }
  };

  const initializeMicrophone = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      connectWebSocket();
      setTimeout(() => startRecordingCycle(), 1000);
    } catch (error) {
      console.error('Microphone access error:', error);
      alert('Please allow microphone access');
    }
  };

  const connectWebSocket = () => {
    const ws = new WebSocket('ws://localhost:8080/ws/transcribe');

    ws.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('Received:', data);

      switch (data.type) {
        case 'transcript':
          setMessages(prev => [...prev, { id: Date.now(), text: data.text, sender: "user" }]);
          break;
        case 'audio_response':
          if (isPlayingAudioRef.current) {
            console.log('❌ DROPPED: Audio already playing');
            return;
          }
          const audioBlob = base64ToBlob(data.audio, 'audio/mpeg');
          const audioUrl = URL.createObjectURL(audioBlob);
          const audio = new Audio(audioUrl);

          audio.onplay = () => { isPlayingAudioRef.current = true; setIsResponding(true); };
          audio.onended = () => { isPlayingAudioRef.current = false; setIsResponding(false); };
          audio.onerror = () => { isPlayingAudioRef.current = false; setIsResponding(false); };

          audio.play();
          setMessages(prev => [...prev, { id: Date.now() + 1, text: data.text, sender: "bot" }]);
          break;
      }
    };

    ws.onclose = () => setIsConnected(false);
    wsRef.current = ws;
  };

  const base64ToBlob = (base64: string, mimeType: string) => {
    const byteCharacters = atob(base64);
    const byteArrays = [];
    for (let i = 0; i < byteCharacters.length; i++) {
      byteArrays.push(byteCharacters.charCodeAt(i));
    }
    return new Blob([new Uint8Array(byteArrays)], { type: mimeType });
  };

  const startRecordingCycle = () => {
    if (!streamRef.current || !wsRef.current) return;
    startRecording();
  };

  const sendAccumulatedAudio = async () => {
    if (audioChunksBuffer.current.length === 0) return;

    const combinedBlob = new Blob(audioChunksBuffer.current, { type: 'audio/webm' });
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      wsRef.current?.send(JSON.stringify({ type: 'start' }));
      wsRef.current?.send(JSON.stringify({ type: 'audio', audio: base64, editorContent: editorText }));
      wsRef.current?.send(JSON.stringify({ type: 'stop' }));
    };
    reader.readAsDataURL(combinedBlob);
    audioChunksBuffer.current = [];
  };

  const startRecording = async () => {
    if (!wsRef.current) return;

    try {
      if (!streamRef.current || !streamRef.current.active) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
      }

      const mediaRecorder = new MediaRecorder(streamRef.current);
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        const hasSpeech = await detectSpeech(audioBlob);

        if (hasSpeech) {
          consecutiveSilenceCountRef.current = 0;
          audioChunksBuffer.current.push(audioBlob);
          startRecording();
        } else {
          consecutiveSilenceCountRef.current++;
          if (consecutiveSilenceCountRef.current >= silenceThreshold && audioChunksBuffer.current.length > 0) {
            consecutiveSilenceCountRef.current = 0;
            await sendAccumulatedAudio();
          }
          startRecording();
        }
      };

      mediaRecorder.start(100);
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);

      if (timerRef.current) clearInterval(timerRef.current);

      setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop();
          setIsRecording(false);
          if (timerRef.current) clearInterval(timerRef.current);
        }
      }, 3000);
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  };

  const cleanup = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    audioChunksBuffer.current = [];
  };

  return (
    <>
      {showRules && <RulesModal onClose={() => setShowRules(false)} />}

      {showEndModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-lg p-6 max-w-2xl w-full mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold mb-4">Interview Complete</h3>

            {isEvaluating ? (
              <div className="flex flex-col items-center gap-4 py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                <p className="text-muted-foreground">Generating your feedback...</p>
              </div>
            ) : evaluationResult?.breakdown ? (
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Performance Summary:</h4>
                  <p className="text-sm text-muted-foreground">{evaluationResult.summary}</p>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Score Breakdown:</h4>
                  <div className="space-y-2 text-sm">
                    {Object.entries(evaluationResult.breakdown).map(([key, value]: [string, any]) => (
                      <div key={key} className="flex justify-between">
                        <span className="text-muted-foreground">{key}:</span>
                        <span className="font-medium">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-border pt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold">Final Score:</span>
                    <span className="text-3xl font-bold text-primary">{evaluationResult.finalScore}/100</span>
                  </div>
                </div>

                <button
                  onClick={handleEndInterview}
                  className="w-full bg-primary text-primary-foreground py-2 rounded-lg font-semibold hover:brightness-110 mt-4"
                >
                  Back to Home
                </button>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-muted-foreground mb-4">Evaluation failed to load</p>
                <button
                  onClick={handleEndInterview}
                  className="bg-primary text-primary-foreground px-6 py-2 rounded-lg font-semibold hover:brightness-110"
                >
                  Back to Home
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex h-screen w-full">
        <div className="w-2/3 border-r border-border">
          <TextEditor
            isRecording={isRecording}
            isResponding={isResponding}
            text={editorText}
            setText={setEditorText}
            timerLimit={interviewTimer}
            onTimeUp={handleTimeUp}
          />
        </div>
        <div className="w-1/3 flex flex-col">
          <div className="h-1/3">
            <ProfileCard isResponding={isResponding} />
          </div>
          <div className="h-2/3">
            <ChatWindow messages={messages} />
          </div>
        </div>
      </div>
    </>
  );
};

export default Index;
