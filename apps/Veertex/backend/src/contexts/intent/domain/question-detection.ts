/**
 * Interrogativa nunca vira comando de escrita.
 *
 * **O defeito que originou esta função** (achado por Eliab em 13/08/2026): o gatilho `'pode '` do
 * tradutor por palavra-chave transformava *"quem pode dar desconto"* em `SetRolePermissions`. Quem
 * fez uma pergunta recebia um rascunho de ALTERAÇÃO de papel — e, se aprovasse sem ler, mudava
 * permissão por ter perguntado. É risco de classe, não caso isolado: `"quem pode X"`, `"a Ana pode
 * X?"`, `"por que a Ana pode X"` são todas interrogativas que casam com gatilhos de escrita, e o
 * mesmo vale para `"como cadastrar empresa"` contra o gatilho `'cadastrar empresa'`.
 *
 * **Por que a guarda é compartilhada pelos dois adapters.** Medido em 13/08/2026 contra a API real: o
 * Gemini classificava as quatro interrogativas corretamente como `null`, e o determinístico errava as
 * quatro. Um adapter de teste que se comporta melhor ou pior que o de produção mente sobre o sistema —
 * e é o determinístico que a suíte usa. Com a mesma função nos dois, a divergência deixa de ser
 * possível por construção.
 *
 * No adapter do Gemini a guarda é a SEGUNDA camada: a `systemInstruction` já proíbe inferir escrita de
 * interrogativa. Manter as duas é o Princípio 4 do CLAUDE.md — a saída de um LLM é dado de fora, e
 * "hoje ele acertou quatro de quatro" não é contrato com um modelo probabilístico.
 */

/**
 * Marcadores no INÍCIO da frase. Só no início de propósito: `"cadastrar empresa que vende tinta"` tem
 * um "que" no meio e é imperativa legítima.
 */
const LEADING_MARKERS = [
  'quem',
  'qual',
  'quais',
  'quanto',
  'quantos',
  'quanta',
  'quantas',
  'quando',
  'onde',
  'aonde',
  'como',
  'por que',
  'porque',
  'porquê',
  'pq',
  'o que',
  'será que',
  'sera que',
  'tem como',
];

/**
 * `true` quando a frase tem FORMA de pergunta.
 *
 * Dois sinais, ambos de forma e nenhum de significado — porque significado é o que o tradutor de
 * produção faz, e esta função precisa ser igualmente barata e determinística nos dois adapters:
 *
 *  1. termina em `?`;
 *  2. começa com pronome ou advérbio interrogativo.
 *
 * **Limite conhecido e deliberado:** pergunta sem `?` e sem marcador inicial — `"quero saber quem
 * pode dar desconto"` — não é detectada. Ampliar para "contém marcador em qualquer posição"
 * recusaria imperativas legítimas, e recusar o que o usuário pediu de verdade é o defeito oposto,
 * também caro. O tradutor de produção resolve esses casos por significado; a guarda existe para o
 * piso, não para o teto.
 */
export function looksLikeQuestion(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  if (normalized === '') {
    return false;
  }
  if (normalized.endsWith('?')) {
    return true;
  }
  return LEADING_MARKERS.some(
    (marker) => normalized === marker || normalized.startsWith(`${marker} `),
  );
}

/**
 * O `guess` de uma interrogativa recusada.
 *
 * Diz a verdade sobre o motivo — o catálogo só tem comandos de alteração — em vez de um "não entendi"
 * que faria o operador repetir a mesma pergunta com outras palavras.
 */
export const QUESTION_GUESS = 'uma consulta — eu sei executar alterações, não responder perguntas';
