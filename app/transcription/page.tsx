"use client";

/**
 * Transcription debug page — used during development to test the
 * WebSocket + voice recording pipeline in isolation, without the
 * full interview UI. Not part of the main user flow.
 */

import { useState, useEffect, useRef } from "react";
import { detectSpeech, base64ToBlob, blobsToBase64 } from "@/lib/audioUtils";

const CHUNK_DURATION_MS = 5000;

export default function TranscriptionPage() {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [status, setStatus] = useState("Initializing...");
  const [recordingTime, setRecordingTime] = useState(0);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [accumulatedChunks, setAccumulatedChunks] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioChunksBuffer = useRef<Blob[]>([]);
  const isAISpeakingRef = useRef(false);

  useEffect(() => {
    initializeMicrophone();
    return () => cleanup();
  }, []);

  const initializeMicrophone = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setStatus("Microphone ready");
      connectWebSocket();
      setTimeout(() => startRecording(), 1000);
    } catch {
      setStatus("Microphone access denied");
      alert("Please allow microphone access to use transcription");
    }
  };

  const connectWebSocket = () => {
    const ws = new WebSocket("ws://localhost:8080/ws/transcribe");

    ws.onopen = () => {
      setIsConnected(true);
      setStatus("Connected - Ready to record");
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case "connected":
          setStatus("Ready");
          break;
        case "transcript":
          setTranscript((prev) => prev + "\n\nYou: " + data.text);
          break;
        case "audio_response":
          isAISpeakingRef.current = true;
          setIsAISpeaking(true);

          const audioBlob = base64ToBlob(data.audio, "audio/mpeg");
          const audioUrl = URL.createObjectURL(audioBlob);
          const audio = new Audio(audioUrl);

          audio.onended = () => {
            isAISpeakingRef.current = false;
            setIsAISpeaking(false);
          };

          audio.play();
          setTranscript((prev) => prev + "\n\nAI: " + data.text + "\n");
          break;
        case "status":
          setStatus(data.message);
          break;
        case "error":
          setStatus("Error: " + data.message);
          break;
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      setStatus("Disconnected");
    };

    ws.onerror = () => setStatus("Connection Error");

    wsRef.current = ws;
  };

  const sendAccumulatedAudio = async () => {
    if (audioChunksBuffer.current.length === 0) return;

    const base64 = await blobsToBase64(audioChunksBuffer.current);
    audioChunksBuffer.current = [];
    setAccumulatedChunks(0);
    setStatus("Sent to backend - Listening...");

    wsRef.current?.send(JSON.stringify({ type: "start" }));
    wsRef.current?.send(JSON.stringify({ type: "audio", audio: base64 }));
    wsRef.current?.send(JSON.stringify({ type: "stop" }));
  };

  const startRecording = async () => {
    if (isAISpeakingRef.current) {
      setTimeout(startRecording, 1000);
      return;
    }
    if (!wsRef.current) return;

    try {
      if (!streamRef.current?.active) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
      }

      const mediaRecorder = new MediaRecorder(streamRef.current!);
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: "audio/webm" });
        const hasSpeech = await detectSpeech(audioBlob);

        if (hasSpeech) {
          audioChunksBuffer.current.push(audioBlob);
          setAccumulatedChunks(audioChunksBuffer.current.length);
          setStatus(`Recording... (${audioChunksBuffer.current.length} chunks)`);
        } else if (audioChunksBuffer.current.length > 0) {
          setStatus("Silence detected - Sending to backend...");
          await sendAccumulatedAudio();
        } else {
          setStatus("Listening...");
        }

        startRecording();
      };

      mediaRecorder.start(100);
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setRecordingTime(0);

      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(
        () => setRecordingTime((p) => p + 1),
        1000
      );

      setTimeout(() => {
        if (mediaRecorderRef.current?.state === "recording") {
          mediaRecorderRef.current.stop();
          setIsRecording(false);
          if (timerRef.current) clearInterval(timerRef.current);
        }
      }, CHUNK_DURATION_MS);
    } catch {
      setStatus("Recording error");
    }
  };

  const cleanup = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.close();
    if (timerRef.current) clearInterval(timerRef.current);
    audioChunksBuffer.current = [];
  };

  const stopAll = () => {
    cleanup();
    setIsRecording(false);
    setStatus("Stopped");
    setAccumulatedChunks(0);
  };

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Live Transcription</h1>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-3 h-3 rounded-full ${
                  isConnected ? "bg-green-500" : "bg-red-500"
                }`}
              />
              <span className="font-medium">{status}</span>
            </div>
            <button
              onClick={stopAll}
              className="px-6 py-2 rounded-lg font-medium bg-red-500 hover:bg-red-600 text-white"
            >
              Stop All
            </button>
          </div>

          <div className="flex gap-4 text-sm">
            <div
              className={`px-4 py-2 rounded ${
                isRecording ? "bg-red-100 text-red-700" : "bg-gray-100"
              }`}
            >
              {isRecording ? `Recording: ${recordingTime}s / 5s` : "Waiting..."}
            </div>
            <div
              className={`px-4 py-2 rounded ${
                accumulatedChunks > 0
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-100"
              }`}
            >
              Buffered: {accumulatedChunks} chunks
            </div>
            <div
              className={`px-4 py-2 rounded ${
                isAISpeaking ? "bg-yellow-100 text-yellow-700" : "bg-gray-100"
              }`}
            >
              {isAISpeaking ? "AI Speaking" : "Ready"}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-black mb-4">Transcript</h2>
          <div className="min-h-[300px] p-4 bg-gray-50 rounded border">
            <p className="whitespace-pre-wrap text-black">
              {transcript || "Waiting for transcription..."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
