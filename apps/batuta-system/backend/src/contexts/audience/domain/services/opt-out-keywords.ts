/**
 * Keywords that mean "stop messaging me" (§6.5). Exactly the list the spec names — not a broader
 * guess, because a false positive silently and irreversibly removes a contact from every future
 * campaign.
 */
const OPT_OUT_KEYWORDS = ['parar', 'sair', 'cancelar', 'descadastrar', 'remover'] as const;

/** Courtesy words allowed around a keyword: "quero sair", "favor parar", "me remover". */
const COURTESY_WORDS = new Set([
  'quero',
  'favor',
  'por',
  'me',
  'pf',
  'pfv',
  'obrigado',
  'obrigada',
]);

/** Strips accents and case so PARAR, parar, "Parár" and " SAIR " all collapse to the same token. */
function normalize(text: string | null | undefined): string {
  return (
    (text ?? '')
      .normalize('NFD')
      // Unicode combining diacritical marks, written as escapes to keep this source ASCII-safe.
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .trim()
  );
}

/**
 * Detects an opt-out request in an inbound message body (§6.5, case- and accent-insensitive).
 *
 * Matching is deliberately conservative: after stripping punctuation, the keyword must be
 * essentially the WHOLE message. "PARAR" opts out; "não quero parar de receber" does not, and
 * neither does "vou cancelar meu plano de internet". Someone who wants out sends the word; someone
 * using the word in a sentence is talking, and that belongs in the human queue.
 *
 * The cost asymmetry justifies the strictness: a missed opt-out is one more message and a complaint;
 * a wrongly detected one removes a real contact for good, and §6.5 makes that irreversible.
 */
export function isOptOutRequest(body: string | null | undefined): boolean {
  const normalized = normalize(body)
    // Letters and spaces only: "PARAR!!!", "sair.", "(cancelar)" are all the bare word.
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) {
    return false;
  }

  const words = normalized.split(' ');
  if (words.length > 2) {
    return false;
  }

  const isKeyword = (word: string): boolean => OPT_OUT_KEYWORDS.includes(word as never);
  const keywords = words.filter(isKeyword);
  const rest = words.filter((word) => !isKeyword(word));

  // Exactly one keyword, and anything else must be a courtesy word.
  return keywords.length === 1 && rest.every((word) => COURTESY_WORDS.has(word));
}

export const OPT_OUT_KEYWORD_LIST: readonly string[] = OPT_OUT_KEYWORDS;

/**
 * The confirmation sent back to whoever opted out — the ONLY automatic reply the system is allowed
 * to send (§6.5, §1.10). Everything else is drafted by a person.
 */
export const OPT_OUT_CONFIRMATION_MESSAGE =
  'Pronto, você não receberá mais mensagens deste número. Obrigado pelo aviso.';
