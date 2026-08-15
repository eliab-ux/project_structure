'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import intentService from 'src/services/intentService';

/**
 * ⚠️ PARADO E DESLIGADO — não use. O caminho vivo é `useOnDeviceDictation`.
 *
 * Este hook grava e manda o ÁUDIO para o nosso backend, que o envia ao Gemini. Ele está completo e
 * testado até a fronteira do envio, e **não está ligado a tela nenhuma**:
 * `AUDIO_TRANSCRIPTION_ENABLED=false`, o backend recusa a rota, e o botão não é renderizado.
 *
 * Ligá-lo exige decisão do Eliab sobre enviar áudio a terceiro — voz é biometria e o microfone capta
 * o ambiente. Ver `Requisitos/ADR-0005_Captura_de_Voz.md`, que lista as quatro perguntas que
 * precisam de resposta antes. "Está pronto" não é argumento.
 */

/**
 * DITADO POR VOZ — grava no navegador, transcreve no nosso backend, devolve texto para o campo.
 *
 * Substitui a Web Speech API (decisão de Eliab, 15/08/2026). O caminho anterior tinha duas
 * limitações que nenhum ajuste de código resolvia: em pt-BR on-device só existe o nível `command`, e
 * nome próprio derretia — *"Tudodicasa"* virava *"de casa"*. Gravar e mandar o áudio para um modelo
 * multimodal remove as duas de uma vez. **Não existem dois caminhos**: a Web Speech saiu do código.
 *
 * ## O que este hook garante
 *
 * 1. **A transcrição é rascunho, nunca comando.** O texto volta para o campo e o operador lê antes
 *    de enviar. É a única coisa que impede uma permissão invertida por erro de transcrição de chegar
 *    ao banco — e é por isso que o hook devolve texto, e não dispara nada.
 * 2. **Falhou, o áudio FICA.** Erro de rede ou timeout mantém o blob em memória e expõe `retentar()`.
 *    Descartar o que a pessoa acabou de falar é o pior desfecho possível: ela falou, esperou, e teria
 *    de falar de novo.
 * 3. **Teto de 60 s**, com parada automática. Sem ele, um botão esquecido pressionado vira um upload
 *    grande e uma conta cara.
 * 4. **O microfone só existe se o backend disser que existe** — `capabilities()`. A flag mora num
 *    lugar só, no servidor.
 */

export type VoiceState = 'unsupported' | 'disabled' | 'idle' | 'recording' | 'sending' | 'error';

const LIMITE_MS = 60_000;

/** Opus mono a 16 kHz: fala inteligível no menor tamanho, que é o que atravessa a rede e é cobrado. */
const RESTRICOES: MediaStreamConstraints = {
  audio: {
    channelCount: 1,
    sampleRate: 16_000,
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
};

function tipoSuportado(): string | null {
  if (typeof MediaRecorder === 'undefined') {
    return null;
  }
  const candidatos = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
  return candidatos.find((tipo) => MediaRecorder.isTypeSupported(tipo)) ?? null;
}

export interface VoiceRun {
  /** Bytes efetivamente enviados — a métrica de tamanho do áudio. */
  bytes: number;
  /** Do fim da fala (parar) até o texto na tela. É a latência que o critério mede. */
  ms: number;
  text: string;
}

export function useVoiceDictation(onText: (texto: string) => void) {
  const [state, setState] = useState<VoiceState>('idle');
  const [level, setLevel] = useState(0);
  const [lastRun, setLastRun] = useState<VoiceRun | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const limiteRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** O áudio que falhou, guardado para `retentar()`. */
  const pendenteRef = useRef<{ blob: Blob; mimeType: string } | null>(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  // A flag vive no servidor: uma cópia em `NEXT_PUBLIC_` divergiria no dia em que só um lado mudasse.
  useEffect(() => {
    let vivo = true;
    intentService
      .capabilities()
      .then((cap) => {
        if (!vivo) return;
        if (!cap.audioTranscription) {
          setState('disabled');
        } else if (!tipoSuportado()) {
          setState('unsupported');
        }
      })
      .catch(() => {
        if (vivo) setState('disabled');
      });
    return () => {
      vivo = false;
    };
  }, []);

  const limpar = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (limiteRef.current) clearTimeout(limiteRef.current);
    limiteRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void audioCtxRef.current?.close().catch(() => undefined);
    audioCtxRef.current = null;
    setLevel(0);
  }, []);

  const enviar = useCallback(async (blob: Blob, mimeType: string, fimDaFala: number) => {
    setState('sending');
    try {
      const buffer = await blob.arrayBuffer();
      // base64 sem `FileReader`: o texto vai direto no JSON, como o resto dos uploads do projeto.
      let binario = '';
      const bytes = new Uint8Array(buffer);
      for (let i = 0; i < bytes.length; i += 1) binario += String.fromCharCode(bytes[i]);
      const base64 = btoa(binario);

      const { text } = await intentService.transcribe(base64, mimeType);

      pendenteRef.current = null;
      setLastRun({ bytes: blob.size, ms: Math.round(performance.now() - fimDaFala), text });
      setState('idle');
      if (text.trim()) onTextRef.current(text.trim());
    } catch {
      // O áudio FICA. Quem falou não deve ter de falar de novo por causa de uma falha de rede.
      pendenteRef.current = { blob, mimeType };
      setState('error');
    }
  }, []);

  const parar = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state === 'recording') {
      recorder.stop();
    }
  }, []);

  const gravar = useCallback(async () => {
    if (
      state === 'disabled' ||
      state === 'unsupported' ||
      state === 'recording' ||
      state === 'sending'
    ) {
      return;
    }
    const mimeType = tipoSuportado();
    if (!mimeType) {
      setState('unsupported');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia(RESTRICOES);
      streamRef.current = stream;

      // Medidor de nível: sem ele, o usuário não sabe se o microfone está captando — e fala mais
      // alto, ou repete, ou desiste. É o retorno que substitui o "ouvindo" do caminho anterior.
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const dados = new Uint8Array(analyser.frequencyBinCount);
      const medir = () => {
        analyser.getByteTimeDomainData(dados);
        let soma = 0;
        for (let i = 0; i < dados.length; i += 1) {
          const v = (dados[i] - 128) / 128;
          soma += v * v;
        }
        setLevel(Math.min(1, Math.sqrt(soma / dados.length) * 3));
        rafRef.current = requestAnimationFrame(medir);
      };
      medir();

      const recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 24_000 });
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const fimDaFala = performance.now();
        limpar();
        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];
        recorderRef.current = null;
        if (blob.size < 1_000) {
          // Clique sem fala. Voltar para `idle` em silêncio é melhor que um erro para algo que o
          // usuário claramente não quis.
          setState('idle');
          return;
        }
        void enviar(blob, mimeType, fimDaFala);
      };

      recorder.start();
      setState('recording');
      limiteRef.current = setTimeout(() => parar(), LIMITE_MS);
    } catch {
      // Permissão negada ou sem dispositivo. Nada de alarde: o campo de texto continua ali.
      limpar();
      setState('idle');
    }
  }, [state, enviar, limpar, parar]);

  const retentar = useCallback(() => {
    const pendente = pendenteRef.current;
    if (pendente) void enviar(pendente.blob, pendente.mimeType, performance.now());
  }, [enviar]);

  const descartar = useCallback(() => {
    pendenteRef.current = null;
    setState('idle');
  }, []);

  useEffect(() => () => limpar(), [limpar]);

  return {
    state,
    level,
    lastRun,
    gravar,
    parar,
    retentar,
    descartar,
    /** O microfone só é renderizado quando isto é verdadeiro. */
    disponivel: state !== 'disabled' && state !== 'unsupported',
    temAudioPendente: pendenteRef.current !== null,
  };
}
