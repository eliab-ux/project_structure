'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { ACCESS_TOKEN_KEY } from 'src/services/api';
import { AudioAction, BallAction, ChatMessage } from 'src/types';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3005';

const EVENTS = {
  JOIN_SESSION: 'join-session',
  USER_JOINED: 'user-joined',
  PEER_PRESENT: 'peer-present',
  END_CALL: 'end-call',
  DISCONNECT_USER: 'disconnect_user',
  BALL_HANDLER: 'ball-handler',
  AUDIO_HANDLER: 'audio-handler',
  NEW_MESSAGE: 'new-message',
} as const;

interface UseEmdrSocketOptions {
  sessionCode: string;
  onBall?: (action: BallAction) => void;
  onAudio?: (action: AudioAction) => void;
  onMessage?: (message: ChatMessage) => void;
  onUserJoined?: () => void;
  onEndCall?: () => void;
}

/**
 * Hook único de tempo real (substitui a classe WebsocketServer legada). Token JWT próprio
 * no handshake (`auth.token`) — nunca na query string. Entra na sessão e expõe emitters.
 */
export function useEmdrSocket(options: UseEmdrSocketOptions) {
  const { sessionCode, onBall, onAudio, onMessage, onUserJoined, onEndCall } = options;
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [joined, setJoined] = useState(false);
  // Presença do OUTRO participante na room (independe do vídeo WebRTC).
  const [peerOnline, setPeerOnline] = useState(false);
  // Exposto para o hook de WebRTC reusar a MESMA conexão/room (sinalização P2P).
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? sessionStorage.getItem(ACCESS_TOKEN_KEY) : null;
    if (!token || !sessionCode) {
      return undefined;
    }

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
    });
    socketRef.current = socket;
    setSocket(socket);

    socket.on('connect', () => {
      setConnected(true);
      socket.emit(EVENTS.JOIN_SESSION, { sessionCode }, () => setJoined(true));
    });
    socket.on('disconnect', () => {
      setConnected(false);
      setJoined(false);
      setPeerOnline(false);
    });

    // Presença por socket (chega mesmo se o vídeo WebRTC não conectar).
    socket.on(EVENTS.USER_JOINED, () => setPeerOnline(true));
    socket.on(EVENTS.PEER_PRESENT, () => setPeerOnline(true));
    socket.on(EVENTS.DISCONNECT_USER, () => setPeerOnline(false));

    if (onBall) socket.on(EVENTS.BALL_HANDLER, onBall);
    if (onAudio) socket.on(EVENTS.AUDIO_HANDLER, onAudio);
    if (onMessage) socket.on(EVENTS.NEW_MESSAGE, onMessage);
    if (onUserJoined) socket.on(EVENTS.USER_JOINED, onUserJoined);
    if (onEndCall) socket.on(EVENTS.END_CALL, onEndCall);

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setSocket(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionCode]);

  const emitBall = useCallback((action: BallAction) => {
    socketRef.current?.emit(EVENTS.BALL_HANDLER, action);
  }, []);

  const emitAudio = useCallback((action: AudioAction) => {
    socketRef.current?.emit(EVENTS.AUDIO_HANDLER, action);
  }, []);

  const sendMessage = useCallback((text: string) => {
    socketRef.current?.emit(EVENTS.NEW_MESSAGE, { text });
  }, []);

  const endCall = useCallback(() => {
    socketRef.current?.emit(EVENTS.END_CALL);
  }, []);

  return { socket, connected, joined, peerOnline, emitBall, emitAudio, sendMessage, endCall };
}
