"use client";

import { useState, useCallback, useRef } from "react";
import { useWebSocket } from "./useWebSocket";
import { useVoiceRecording } from "./useVoiceRecording";
import { base64ToBlob } from "@/lib/audioUtils";
import { evaluateInterview } from "@/lib/interviewApi";
import { Message, EvaluationResult } from "@/lib/types";

interface UseInterviewReturn {
  messages: Message[];
  isConnected: boolean;
  isRecording: boolean;
  isResponding: boolean;
  isEvaluating: boolean;
  evaluationResult: EvaluationResult | null;
  editorText: string;
  setEditorText: (text: string) => void;
  startInterview: () => Promise<void>;
  endInterview: () => Promise<void>;
}

/**
 * Top-level interview orchestrator.
 * Composes useWebSocket + useVoiceRecording and wires them together:
 *   - Routes incoming WS messages to state updates and audio playback.
 *   - Forwards speech-ready audio from the recorder to the WebSocket.
 *   - Calls the evaluation API when the interview ends.
 */
export function useInterview(): UseInterviewReturn {
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, text: "Hey! How's the writing going?", sender: "bot" },
  ]);
  const [isResponding, setIsResponding] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationResult, setEvaluationResult] =
    useState<EvaluationResult | null>(null);
  const [editorText, setEditorText] = useState("");

  // Refs so callbacks always see the latest values without re-subscribing
  const editorTextRef = useRef(editorText);
  editorTextRef.current = editorText;
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const isPlayingAudio = useRef(false);

  const { isConnected, connect, send, disconnect } = useWebSocket();

  // --- Incoming WS message handler ---
  const handleMessage = useCallback((data: any) => {
    switch (data.type) {
      case "transcript":
        setMessages((prev) => [
          ...prev,
          { id: Date.now(), text: data.text, sender: "user" },
        ]);
        break;

      case "audio_response":
        // Drop concurrent responses — only one AI voice at a time
        if (isPlayingAudio.current) return;

        const blob = base64ToBlob(data.audio, "audio/mpeg");
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);

        audio.onplay = () => {
          isPlayingAudio.current = true;
          setIsResponding(true);
        };
        audio.onended = () => {
          isPlayingAudio.current = false;
          setIsResponding(false);
        };
        audio.onerror = () => {
          isPlayingAudio.current = false;
          setIsResponding(false);
        };

        audio.play();
        setMessages((prev) => [
          ...prev,
          { id: Date.now() + 1, text: data.text, sender: "bot" },
        ]);
        break;
    }
  }, []);

  // --- Speech-ready callback: forward buffered audio to WS ---
  const handleSpeechReady = useCallback(
    (base64: string, editorContent: string) => {
      send({ type: "start" });
      send({ type: "audio", audio: base64, editorContent });
      send({ type: "stop" });
    },
    [send]
  );

  const { isRecording, start: startVoice, stop: stopVoice } = useVoiceRecording(
    handleSpeechReady,
    () => editorTextRef.current
  );

  // --- Public actions ---
  const startInterview = useCallback(async () => {
    try {
      connect(handleMessage);
      await startVoice();
    } catch {
      alert("Please allow microphone access to start the interview.");
    }
  }, [connect, handleMessage, startVoice]);

  const endInterview = useCallback(async () => {
    stopVoice();
    disconnect();
    setIsEvaluating(true);

    try {
      const result = await evaluateInterview(messagesRef.current);
      setEvaluationResult(result);
    } catch (err) {
      console.error("Evaluation failed:", err);
    } finally {
      setIsEvaluating(false);
    }
  }, [stopVoice, disconnect]);

  return {
    messages,
    isConnected,
    isRecording,
    isResponding,
    isEvaluating,
    evaluationResult,
    editorText,
    setEditorText,
    startInterview,
    endInterview,
  };
}
