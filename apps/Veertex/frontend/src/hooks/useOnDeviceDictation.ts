'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { comporTranscricao } from 'src/hooks/comporTranscricao';

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
  onerror: ((event: { error: string; message?: string }) => void) | null;
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

/**
 * `opening` existe porque o motor demora a abrir, e falar antes dele perde o começo da frase.
 *
 * `error` é DIFERENTE de `unsupported`, e a distinção custou uma tarde (19/08/2026). Antes, uma
 * falha na consulta de disponibilidade caía no mesmo `unsupported` de "este navegador não tem
 * reconhecimento local" — e o microfone sumia da tela sem deixar rastro nenhum. Da tela, os dois
 * são idênticos: não há botão. Da causa, um é permanente e o outro é uma chamada que quebrou.
 *
 * Nos dois casos o botão continua AUSENTE (regra 2 — controle inerte é pior). O que muda é que
 * `error` carrega o motivo em `ultimoErro`, e quem chama o hook pode dizê-lo.
 */
export type OnDeviceState = 'unsupported' | 'error' | 'idle' | 'opening' | 'listening';

/**
 * As respostas de `available()` traduzidas para a ação de quem está na frente da tela. Cada uma
 * pede uma coisa diferente, e é por isso que elas não podem virar a mesma ausência.
 */
const RESPOSTAS: Record<string, string> = {
  downloadable:
    'O pacote de voz em português ainda não está neste computador. O Chrome baixa sob demanda — ' +
    'em Configurações › Idiomas, adicione o reconhecimento de fala em Português (Brasil).',
  downloading:
    'O pacote de voz em português está sendo baixado. Recarregue a página quando terminar.',
  unavailable: 'Este dispositivo não tem reconhecimento de voz local para português.',
};

/**
 * Os códigos da API traduzidos para o que significam PARA O OPERADOR — e cada um leva a uma ação
 * diferente da parte dele. Mensagem genérica ("erro no ditado") não distingue "libere o microfone"
 * de "fale mais alto", e as duas são coisas que só ele pode fazer.
 */
const MOTIVOS: Record<string, string> = {
  'not-allowed': 'Permissão de microfone negada. Libere no cadeado da barra de endereço.',
  'service-not-allowed': 'O navegador recusou o reconhecimento local neste dispositivo.',
  'language-not-supported': 'Português não está disponível para reconhecimento local aqui.',
  'audio-capture': 'Nenhum microfone captou áudio. Verifique o dispositivo de entrada.',
  'no-speech': 'Não ouvi nada. Tente de novo, mais perto do microfone.',
  network: 'Falha de rede no ditado — e isso não deveria acontecer no modo local.',
  aborted: 'O ditado foi interrompido antes de produzir texto.',
};

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
  // O último motivo de falha, para a tela poder dizê-lo. NUNCA vira fallback: saber por que falhou
  // não autoriza tentar outro caminho (regra 3).
  const [ultimoErro, setUltimoErro] = useState<string | null>(null);
  /*
   * POR QUE o microfone não aparece — e existe porque "não aparece" tinha três causas idênticas na
   * tela (19/08/2026): navegador sem a API, API respondendo que o modelo pt-BR não está no disco, e
   * a consulta quebrando. As três produziam ausência silenciosa, e nenhuma delas se resolve do mesmo
   * jeito: a primeira é trocar de navegador, a segunda é baixar o modelo, a terceira é um defeito.
   *
   * O botão continua AUSENTE nos três casos (regra 2). O que muda é que agora há o que dizer.
   */
  const [motivoIndisponivel, setMotivoIndisponivel] = useState<string | null>(null);
  /**
   * O trecho AINDA PROVISÓRIO — a hipótese que o motor está refinando enquanto a pessoa fala.
   *
   * Ele não entra no campo de texto, e a razão é concreta: *"desativar modo"* → *"desativar modo
   * cobre"* → *"desativar modo cobre para conta"* são a MESMA fala sendo refinada, não três trechos.
   * Escrever isso no campo faria o texto se reescrever a cada 200 ms, e um campo que se reescreve
   * sozinho parece defeito. Fica na legenda, apagado, e o campo recebe só o que o motor já firmou.
   */
  const [parcial, setParcial] = useState('');
  const recRef = useRef<OnDeviceSpeechRecognition | null>(null);
  /** O que estava no campo quando o ditado começou — ditar duas vezes complementa, não apaga. */
  const baseRef = useRef('');
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  /*
   * A checagem decide se o botão EXISTE — regra 2. `quality: 'command'` porque é o único nível
   * disponível em pt-BR on-device, e pedir `dictation` faria o microfone sumir onde ele funciona.
   */
  useEffect(() => {
    const SR = construtor();
    if (!SR || typeof SR.available !== 'function') {
      setMotivoIndisponivel(
        'Este navegador não tem reconhecimento de voz local. Chrome 138+ no computador tem; Edge, Firefox e Safari não.',
      );
      setState('unsupported');
      return undefined;
    }
    let vivo = true;
    SR.available({ langs: ['pt-BR'], processLocally: true, quality: 'command' })
      .then((resultado) => {
        if (!vivo) {
          return;
        }
        if (resultado === 'available') {
          setMotivoIndisponivel(null);
          setState('idle');
          return;
        }
        // A resposta VIAJA para a tela. `downloadable` (modelo não baixado) e `unavailable` (não
        // existe para pt-BR aqui) exigem ações opostas de quem está na frente do computador, e antes
        // as duas eram o mesmo nada.
        setMotivoIndisponivel(
          RESPOSTAS[resultado] ?? `Reconhecimento local indisponível (${resultado}).`,
        );
        setState('unsupported');
      })
      .catch((erro: unknown) => {
        if (!vivo) {
          return;
        }
        // A consulta QUEBROU — não é o mesmo que o navegador dizer que não suporta. Vira `error`,
        // com motivo, e o console guarda o objeto inteiro para quem for investigar.
        const motivo = erro instanceof Error ? erro.message : String(erro);
        console.error('[ditado] a consulta de disponibilidade falhou', erro);
        setUltimoErro(`Não foi possível verificar o reconhecimento local: ${motivo}`);
        setMotivoIndisponivel(`A verificação do reconhecimento local falhou: ${motivo}`);
        setState('error');
      });
    return () => {
      vivo = false;
    };
  }, []);

  /**
   * Limpa o aviso depois de exibido. `useCallback` sem dependência não é estilo: a Mesa usa esta
   * função dentro de um efeito, e uma identidade nova a cada render faria o efeito rodar de novo,
   * limpar, re-renderizar — laço infinito.
   */
  const limparErro = useCallback(() => setUltimoErro(null), []);

  const parar = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      // já parado — o `onend` fecha o estado de qualquer forma
    }
  }, []);

  const iniciar = useCallback(
    (baseAtual = '') => {
      const SR = construtor();
      if (!SR || state !== 'idle') {
        return;
      }

      const rec = new SR();
      rec.lang = 'pt-BR';
      // Regra 1 — escrito aqui, e é a linha que não pode sumir num refactor.
      rec.processLocally = true;
      // LIGADO: é o que faz o texto aparecer enquanto se fala. Os parciais já chegavam do motor —
      // medido no log de 19/08/2026, a cada 100–300 ms — e eram descartados, então o texto só surgia
      // no segundo clique. Nada disso muda o caminho do áudio: é o mesmo evento local.
      rec.interimResults = true;
      rec.continuous = true;
      rec.maxAlternatives = 1;

      baseRef.current = baseAtual;
      setParcial('');
      recRef.current = rec;

      rec.onstart = () => setState('listening');
      rec.onresult = (event) => {
        // A composição vive em `comporTranscricao` — módulo puro, com teste próprio.
        const { texto, parcial: provisorio } = comporTranscricao(baseRef.current, event);
        setParcial(provisorio);
        // RASCUNHO no campo, nunca comando — e agora ele cresce à medida que o motor firma cada
        // trecho, em vez de aparecer tudo no fim.
        onTextRef.current(texto);
      };
      rec.onerror = (event) => {
        /*
         * Regra 3: falha é falha. NÃO existe segunda tentativa pela nuvem — nem aqui, nem em lugar
         * nenhum deste arquivo. O campo de texto continua ali, e digitar é o caminho que sempre
         * funcionou.
         *
         * O que mudou em 19/08/2026: o CÓDIGO do erro deixou de ser jogado fora. O handler não
         * recebia sequer o evento, então `not-allowed` (permissão negada), `service-not-allowed`
         * (motor recusou) e `no-speech` (abriu e não ouviu) produziam exatamente a mesma coisa na
         * tela: nada. Três causas, três correções diferentes, e nenhuma pista de qual era.
         */
        setParcial('');
        setUltimoErro(MOTIVOS[event.error] ?? `Falha no ditado (${event.error}).`);
        setState('idle');
      };
      rec.onend = () => {
        recRef.current = null;
        // O provisório MORRE aqui. O que o motor não firmou não vira texto: entregar hipótese não
        // confirmada como se fosse transcrição é a mesma família de "origin: ditado" para OCR.
        setParcial('');
        setState('idle');
      };

      setState('opening');
      setUltimoErro(null);
      try {
        rec.start();
      } catch (erro: unknown) {
        // `start()` recusado — tipicamente porque já havia uma sessão viva, ou porque o motor local
        // não pôde ser aberto. Engolir a exceção deixava o botão voltando ao normal sem explicação.
        console.error('[ditado] start() recusado', erro);
        setUltimoErro(
          erro instanceof Error
            ? `Não foi possível abrir o microfone: ${erro.message}`
            : 'Não foi possível abrir o microfone.',
        );
        setState('idle');
      }
    },
    [state],
  );

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

  return {
    state,
    iniciar,
    parar,
    // `error` também esconde o botão: sem saber se o reconhecimento local existe, oferecê-lo é
    // prometer o que não se pode cumprir. A diferença é que agora há o que dizer sobre isso.
    disponivel: state !== 'unsupported' && state !== 'error',
    ultimoErro,
    limparErro,
    motivoIndisponivel,
    /** O trecho provisório, para a tela mostrá-lo apagado. Vazio quando não há escuta. */
    parcial,
  };
}
