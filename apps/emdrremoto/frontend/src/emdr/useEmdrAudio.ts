'use client';

import { useCallback, useEffect, useRef } from 'react';

/**
 * Áudio com PAN ESTÉREO bilateral: a faixa toca em loop e o balanço (esquerda/direita)
 * acompanha a posição da bola (setPan chamado a cada frame). O AudioContext só é criado
 * após um gesto do usuário (play), como exige o navegador.
 */
export function useEmdrAudio() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const panRef = useRef<StereoPannerNode | null>(null);
  const srcRef = useRef<MediaElementAudioSourceNode | null>(null);
  const volumeRef = useRef(0.4);
  const mutedRef = useRef(false);

  const graphFailedRef = useRef(false);

  const ensureGraph = useCallback(() => {
    if (!audioRef.current) {
      const el = new Audio();
      el.loop = true;
      audioRef.current = el;
    }
    // Se o WebAudio já falhou uma vez, não tenta de novo — o elemento toca direto (sem pan).
    if (!ctxRef.current && !graphFailedRef.current) {
      try {
        const Ctx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new Ctx();
        const src = ctx.createMediaElementSource(audioRef.current);
        const pan = new StereoPannerNode(ctx, { pan: 0 });
        src.connect(pan).connect(ctx.destination);
        ctxRef.current = ctx;
        srcRef.current = src;
        panRef.current = pan;
      } catch {
        // Fallback: sem grafo WebAudio → o <audio> toca direto na saída padrão (com som, sem pan).
        graphFailedRef.current = true;
      }
    }
  }, []);

  const applyVolume = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.volume = mutedRef.current ? 0 : volumeRef.current;
    }
  }, []);

  const load = useCallback(
    (src: string) => {
      ensureGraph();
      if (audioRef.current && audioRef.current.src !== window.location.origin + src) {
        audioRef.current.src = src;
      }
    },
    [ensureGraph],
  );

  const play = useCallback(async () => {
    ensureGraph();
    await ctxRef.current?.resume().catch(() => undefined);
    applyVolume();
    await audioRef.current?.play().catch(() => undefined);
  }, [ensureGraph, applyVolume]);

  // Desbloqueia o AudioContext num gesto do usuário (política de autoplay do navegador),
  // sem iniciar reprodução. Necessário para o som/pan tocarem do lado do paciente.
  const unlock = useCallback(() => {
    ensureGraph();
    void ctxRef.current?.resume().catch(() => undefined);
  }, [ensureGraph]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  const setVolume = useCallback(
    (v0to1: number) => {
      volumeRef.current = Math.max(0, Math.min(1, v0to1));
      applyVolume();
    },
    [applyVolume],
  );

  const setMuted = useCallback(
    (muted: boolean) => {
      mutedRef.current = muted;
      applyVolume();
    },
    [applyVolume],
  );

  const setPan = useCallback((p: number) => {
    if (panRef.current) {
      panRef.current.pan.value = Math.max(-1, Math.min(1, p));
    }
  }, []);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      ctxRef.current?.close().catch(() => undefined);
    };
  }, []);

  return { load, play, pause, setVolume, setMuted, setPan, unlock };
}
