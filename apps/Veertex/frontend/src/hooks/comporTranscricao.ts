/**
 * Compõe o texto do ditado a partir do evento do reconhecedor. **Módulo puro, sem React.**
 *
 * Está fora do hook por uma razão registrada no `CLAUDE.md` (regra 6): esta é a lógica que PRODUZ o
 * texto que o operador vai aprovar, e lógica de composição dentro de um callback do navegador é
 * lógica que nenhum teste alcança. A página de medição do microfone cometeu o mesmo erro duas vezes
 * — acumulação duplicando segmento, e depois oito frases numa linha — e nas duas o resultado errado
 * tinha exatamente a aparência do resultado certo.
 *
 * ## Por que RECONSTRÓI em vez de acumular
 *
 * Com `continuous: true`, `event.results` guarda a sessão inteira, e um índice que era provisório
 * **vira** definitivo alguns eventos depois. Acumular exigiria lembrar o que já foi contado — estado
 * que erra. Reconstruir do zero não tem estado: o mesmo evento sempre produz o mesmo texto, e o
 * mesmo segmento nunca entra duas vezes.
 */

/** O formato mínimo do evento, para não depender do tipo global do DOM. */
export interface ResultadoReconhecimento {
  isFinal: boolean;
  0: { transcript: string };
}

export interface EventoReconhecimento {
  results: ResultadoReconhecimento[] & { length: number };
}

export interface TranscricaoComposta {
  /** O que vai para o campo: a base mais o que o motor já firmou. */
  texto: string;
  /** A hipótese em refinamento — nunca entra no campo; vai apagada na legenda. */
  parcial: string;
}

/**
 * @param base o que estava escrito no campo quando o ditado começou (ditar duas vezes complementa)
 * @param event o evento `result` do reconhecedor
 */
export function comporTranscricao(base: string, event: EventoReconhecimento): TranscricaoComposta {
  let firmado = '';
  let provisorio = '';

  for (let i = 0; i < event.results.length; i += 1) {
    const resultado = event.results[i];
    if (resultado.isFinal) {
      firmado = `${firmado} ${resultado[0].transcript}`;
    } else {
      provisorio = `${provisorio} ${resultado[0].transcript}`;
    }
  }

  /*
   * Junta com UM espaço, sem reescrever o que o operador digitou.
   *
   * `${base} ${firmado}`.trim() não bastava: com a base terminando em espaço (campo onde alguém
   * digitou "cadastrar cliente " e depois ditou), o resultado saía "cadastrar cliente   Nilton" —
   * o trim só corta as pontas, não o meio. Descoberto pelo teste deste módulo, não pelo uso.
   *
   * Espaço duplo DENTRO do que a pessoa escreveu fica como ela escreveu: normalizar o texto dela
   * seria o sistema corrigindo o usuário sem ser pedido.
   */
  return {
    texto: [base.trim(), firmado.trim()].filter(Boolean).join(' '),
    parcial: provisorio.trim(),
  };
}
