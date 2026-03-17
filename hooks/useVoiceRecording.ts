"use client";

import { useRef, useState, useCallback } from "react";
import { detectSpeech, blobsToBase64 } from "@/lib/audioUtils";

// Duration of each recorded audio chunk before VAD analysis
const CHUNK_DURATION_MS = 3000;

// How many consecutive silent chunks trigger a flush of the speech buffer
const SILENCE_FLUSH_THRESHOLD = 2;

interface UseVoiceRecordingReturn {
  isRecording: boolean;
  start: () => Promise<void>;
  stop: () => void;
}

/**
 * Manages the full audio pipeline:
 *   mic permission → continuous 3-second MediaRecorder chunks →
 *   RMS-based speech detection → buffer accumulation →
 *   flush to caller via `onSpeechReady` when silence is detected.
 *
 * @param onSpeechReady  Called with base64-encoded audio when a speech segment ends.
 * @param getEditorContent  Accessor for the current editor text (avoids stale closure).
 */
export function useVoiceRecording(
  onSpeechReady: (base64: string, editorContent: string) => void,
  getEditorContent: () => string
): UseVoiceRecordingReturn {
  const [isRecording, setIsRecording] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const speechBuffer = useRef<Blob[]>([]);
  const consecutiveSilence = useRef(0);
  const isActive = useRef(false);

  const ensureMicStream = async (): Promise<MediaStream> => {
    if (streamRef.current?.active) return streamRef.current;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    return stream;
  };

  const flushSpeechBuffer = async () => {
    if (speechBuffer.current.length === 0) return;
    const base64 = await blobsToBase64(speechBuffer.current);
    speechBuffer.current = [];
    consecutiveSilence.current = 0;
    onSpeechReady(base64, getEditorContent());
  };

  const recordChunk = useCallback(async () => {
    if (!isActive.current) return;

    try {
      const stream = await ensureMicStream();
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        const hasSpeech = await detectSpeech(blob);

        if (hasSpeech) {
          consecutiveSilence.current = 0;
          speechBuffer.current.push(blob);
        } else {
          consecutiveSilence.current++;
          if (
            consecutiveSilence.current >= SILENCE_FLUSH_THRESHOLD &&
            speechBuffer.current.length > 0
          ) {
            await flushSpeechBuffer();
          }
        }

        // Continue the cycle as long as the hook is active
        if (isActive.current) recordChunk();
      };

      recorder.start(100);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);

      setTimeout(() => {
        if (recorder.state === "recording") {
          recorder.stop();
          setIsRecording(false);
        }
      }, CHUNK_DURATION_MS);
    } catch (err) {
      console.error("Recording error:", err);
    }
  }, []);

  const start = useCallback(async () => {
    isActive.current = true;
    await ensureMicStream();
    // Small delay to let the WebSocket settle before the first chunk
    setTimeout(() => recordChunk(), 1000);
  }, [recordChunk]);

  const stop = useCallback(() => {
    isActive.current = false;
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    speechBuffer.current = [];
    setIsRecording(false);
  }, []);

  return { isRecording, start, stop };
}
