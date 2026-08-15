export const AUDIO_TRANSCRIBER = Symbol('AUDIO_TRANSCRIBER');

export interface AudioTranscriptionRequest {
  /** O áudio cru, em base64. Nunca gravado em disco, nunca em log. */
  dataBase64: string;
  /** `audio/webm;codecs=opus` é o que o MediaRecorder do navegador produz. */
  mimeType: string;
}

/**
 * Transcreve áudio em texto. **Transcreve — não interpreta.**
 *
 * A separação é o ponto do desenho (decisão de Eliab, 15/08/2026): o provedor devolve o que foi
 * dito, LITERALMENTE, e a tradução para comando continua sendo nossa, no fluxo de intenção que já
 * existe. Deixar o mesmo provedor fazer as duas coisas numa chamada só pareceria mais simples e
 * apagaria a fronteira onde a validação mora — o catálogo fechado de comandos, o `plano ∩ conta ∩
 * papel`, a exigência de trecho de evidência. Só a captura mudou.
 *
 * **O que a implementação precisa garantir, e o teste verifica:**
 *
 *  - transcrição literal: sem reescrever, sem corrigir gramática, sem pontuar por conta própria;
 *  - **jamais remover negação** — perder um "não" inverte uma permissão, e é o erro que não pode
 *    acontecer nesta cadeia;
 *  - o áudio não entra em log, nem em erro, nem pelo tamanho dentro de um `catch`;
 *  - falha é falha: nada de devolver texto parcial ou inventado. Quem chama mantém o áudio para
 *    retentar.
 */
export interface AudioTranscriberPort {
  /** Lança se o canal não estiver configurado — antes de gastar o tempo do operador. */
  ensureAvailable(): void;

  transcribe(request: AudioTranscriptionRequest): Promise<string>;
}
