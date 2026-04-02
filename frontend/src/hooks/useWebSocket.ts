import { useEffect, useRef, useCallback, useState } from 'react';
import type { ServerMessage, ClientMessage, SessionSummary } from '../types';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8080/ws';

export interface UseWebSocketOptions {
  onSessionCreated?: (sessionId: string) => void;
  onReviewChunk?: (chunk: string) => void;
  onReviewComplete?: (review: any) => void;
  onError?: (error: string) => void;
  onSessionList?: (sessions: SessionSummary[]) => void;
  onSessionLoaded?: (session: any) => void;
  onSessionDeleted?: (sessionId: string) => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const wsRef = useRef<WebSocket | null>(null);
  const optionsRef = useRef(options);
  const [connected, setConnected] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const connectedRef = useRef(false);

  // Update options ref when options change
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const send = useCallback((message: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const listSessions = useCallback(() => {
    send({ type: 'list_sessions' });
  }, [send]);

  // Single connection effect - only runs once on mount
  useEffect(() => {
    // Don't reconnect if already connecting
    if (wsRef.current || connectedRef.current) return;

    const ws = new WebSocket(WS_URL);
    let isMounted = true;

    ws.onopen = () => {
      if (!isMounted) return;
      connectedRef.current = true;
      setConnected(true);
      // Request session list after connecting
      send({ type: 'list_sessions' });
    };

    ws.onmessage = (event) => {
      if (!isMounted) return;
      try {
        const message: ServerMessage = JSON.parse(event.data);

        switch (message.type) {
          case 'session_created':
            setSessionId(message.sessionId);
            optionsRef.current.onSessionCreated?.(message.sessionId);
            break;
          case 'review_chunk':
            optionsRef.current.onReviewChunk?.(message.content);
            break;
          case 'review_complete':
            optionsRef.current.onReviewComplete?.(message.review);
            break;
          case 'review_error':
            optionsRef.current.onError?.(message.error);
            break;
          case 'session_list':
            optionsRef.current.onSessionList?.(message.sessions);
            break;
          case 'session_loaded':
            optionsRef.current.onSessionLoaded?.(message.session);
            break;
          case 'session_deleted':
            optionsRef.current.onSessionDeleted?.(message.sessionId);
            break;
          case 'error':
            optionsRef.current.onError?.(message.message);
            break;
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    ws.onerror = () => {
      if (!isMounted) return;
      optionsRef.current.onError?.('WebSocket connection error');
    };

    ws.onclose = () => {
      if (!isMounted) return;
      connectedRef.current = false;
      setConnected(false);
      wsRef.current = null;
    };

    wsRef.current = ws;

    // Cleanup function
    return () => {
      isMounted = false;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []); // Empty dependency array - connect only once on mount

  const submitReview = useCallback((code: string, language?: string) => {
    send({ type: 'review_request', code, language });
  }, [send]);

  const loadSession = useCallback((sessionId: string) => {
    send({ type: 'load_session', sessionId });
  }, [send]);

  const deleteSession = useCallback((sessionId: string) => {
    send({ type: 'delete_session', sessionId });
  }, [send]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
      connectedRef.current = false;
      setConnected(false);
    }
  }, []);

  return {
    connected,
    sessionId,
    submitReview,
    loadSession,
    deleteSession,
    listSessions,
    disconnect,
  };
}
