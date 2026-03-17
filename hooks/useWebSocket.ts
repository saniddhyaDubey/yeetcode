"use client";

import { useRef, useState, useCallback } from "react";

const WS_URL = "ws://localhost:8080/ws/transcribe";

interface UseWebSocketReturn {
  isConnected: boolean;
  connect: (onMessage: (data: any) => void) => void;
  send: (payload: object) => void;
  disconnect: () => void;
}

/**
 * Manages a single WebSocket connection to the backend transcription service.
 * Handles connect, disconnect, and sending JSON payloads.
 * Message parsing and routing is handled by the caller via `onMessage`.
 */
export function useWebSocket(): UseWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const connect = useCallback((onMessage: (data: any) => void) => {
    const ws = new WebSocket(WS_URL);

    ws.onopen = () => setIsConnected(true);
    ws.onclose = () => setIsConnected(false);
    ws.onerror = () => setIsConnected(false);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch {
        // Ignore malformed frames
      }
    };

    wsRef.current = ws;
  }, []);

  const send = useCallback((payload: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.close();
    }
    wsRef.current = null;
  }, []);

  return { isConnected, connect, send, disconnect };
}
