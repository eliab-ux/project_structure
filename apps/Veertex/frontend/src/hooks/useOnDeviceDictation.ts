'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Ditado **ON-DEVICE** — o áudio não sai da máquina.
 *
 * É o caminho vivo do produto (decisão de Eliab, 15/08/2026). Existe também uma implementação de
 * gravação + transcrição no Gemini (`useVoiceDictation`), **desligada e parada** — ver
 * `Requisitos/ADR-0005_Captura_de_Voz.md`. Ligar aquela exige decisão do Eliab sobre enviar áudio a
 * terceiro; esta não exige nenhuma, porque nada é enviado.
 *
 * ## As três regras, e por que elas são a razão de o microfone existir
 *
 * 1. **`processLocally: true` SEMPRE.** O padrão da API é `false`, e `false` deixa o navegador
 *    escolher — podendo mandar o áudio para servidores do Google. O padrão da API é o oposto do
 *    nosso, então ele é escrito em toda instância, sem exceção.
 * 2. **`available()` diferente de `'available'` → o microfone NÃO APARECE.** Não desabilitado:
 *    ausente. Controle inerte é promessa de recurso que não existe.
 * 3. **Nunca cair para a nuvem por acidente.** `language-not-supported` é resposta final, não motivo
 *    para tentar o outro caminho. Não há fallback — nem em erro, nem em timeout.
 *
 * Uma implementação que viole qualquer uma delas **reabre a decisão de LGPD que elas fecham**, e
 * reabrir é voltar ao Eliab antes de escrever a linha, não depois.
 *
 * ## Por que só na Mesa
 *
 * Em pt-BR on-device só existe o nível `command` (`dictation` responde `unavailable` inclusive em
 * `en-US` — é a versão do motor, não falta de pacote português; **isso está medido**). `command` foi
 * feito para frase curta e imperativa, que é o que a Mesa recebe: *"ativar módulo VND"*, *"criar
 * papel de supervisor"*.
 *
 * A tela de Papéis fica **sem microfone**, por critério do Eliab e independentemente do resultado da
 * medição de qualidade: lá a frase é ditado corrido com negação, e uma negação perdida inverte uma
 * permissão. O custo desse erro não se compara ao de digitar.
 */

interface OnDeviceSpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  processLocally: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onresult:
    | ((event: {
        resultIndex: number;
        results: { isFinal: boolean; 0: { transcript: string } }[] & { length: number };
      }) => void)
    | null;
}

interface SpeechRecognitionConstructor {
  new (): OnDeviceSpeechRecognition;
  available?: (options: {
    langs: string[];
    processLocally?: boolean;
    quality?: 'command' | 'dictation' | 'conversation';
  }) => Promise<string>;
}

/** `opening` existe porque o motor demora a abrir, e falar antes dele perde o começo da frase. */
export type OnDeviceState = 'unsupported' | 'idle' | 'opening' | 'listening';

function construtor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useOnDeviceDictation(onText: (texto: string) => void) {
  const [state, setState] = useState<OnDeviceState>('unsupported');
  const recRef = useRef<OnDeviceSpeechRecognition | null>(null);
  const bufferRef = useRef('');
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  /*
   * A checagem decide se o botão EXISTE — regra 2. `quality: 'command'` porque é o único nível
   * disponível em pt-BR on-device, e pedir `dictation` faria o microfone sumir onde ele funciona.
   */
  useEffect(() => {
    const SR = construtor();
    if (!SR || typeof SR.available !== 'function') {
      setState('unsupported');
      return undefined;
    }
    let vivo = true;
    SR.available({ langs: ['pt-BR'], processLocally: true, quality: 'command' })
      .then((resultado) => {
        if (vivo) {
          setState(resultado === 'available' ? 'idle' : 'unsupported');
        }
      })
      .catch(() => {
        if (vivo) {
          setState('unsupported');
        }
      });
    return () => {
      vivo = false;
    };
  }, []);

  const parar = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      // já parado — o `onend` fecha o estado de qualquer forma
    }
  }, []);

  const iniciar = useCallback(() => {
    const SR = construtor();
    if (!SR || state !== 'idle') {
      return;
    }

    const rec = new SR();
    rec.lang = 'pt-BR';
    // Regra 1 — escrito aqui, e é a linha que não pode sumir num refactor.
    rec.processLocally = true;
    rec.interimResults = false;
    rec.continuous = true;
    rec.maxAlternatives = 1;

    bufferRef.current = '';
    recRef.current = rec;

    rec.onstart = () => setState('listening');
    rec.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const resultado = event.results[i];
        if (!resultado.isFinal) {
          continue;
        }
        bufferRef.current = `${bufferRef.current} ${resultado[0].transcript}`.trim();
      }
    };
    rec.onerror = () => {
      /*
       * Regra 3: falha é falha. NÃO existe segunda tentativa pela nuvem — nem aqui, nem em lugar
       * nenhum deste arquivo. O campo de texto continua ali, e digitar é o caminho que sempre
       * funcionou.
       */
      bufferRef.current = '';
      setState('idle');
    };
    rec.onend = () => {
      recRef.current = null;
      const texto = bufferRef.current.trim();
      bufferRef.current = '';
      setState('idle');
      if (texto) {
        // RASCUNHO no campo, nunca comando: o operador lê antes de enviar.
        onTextRef.current(texto);
      }
    };

    setState('opening');
    try {
      rec.start();
    } catch {
      setState('idle');
    }
  }, [state]);

  useEffect(
    () => () => {
      try {
        recRef.current?.abort();
      } catch {
        // desmontando
      }
    },
    [],
  );

  return { state, iniciar, parar, disponivel: state !== 'unsupported' };
}
