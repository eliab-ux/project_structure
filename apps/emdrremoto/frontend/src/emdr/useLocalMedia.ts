'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Câmera + microfone locais (getUserMedia). Liga/desliga cada faixa sem derrubar o stream.
 * Sem provedor de vídeo configurado, serve como self-view (o botão faz algo visível/real).
 */
export function useLocalMedia() {
  const streamRef = useRef<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async (): Promise<MediaStream | null> => {
    if (streamRef.current) {
      return streamRef.current;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      setActive(true);
      setError(null);
      return stream;
    } catch {
      setError('Não foi possível acessar câmera/microfone (permissão negada?).');
      return null;
    }
  }, []);

  const toggleMic = useCallback(() => {
    const track = streamRef.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setMicOn(track.enabled);
    }
  }, []);

  const toggleCam = useCallback(() => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setCamOn(track.enabled);
    }
  }, []);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setActive(false);
  }, []);

  useEffect(() => () => stop(), [stop]);

  return { start, stop, toggleMic, toggleCam, micOn, camOn, active, error, streamRef };
}
