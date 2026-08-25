/** Particles that are never the "first name" of a person. */
const PARTICLES = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'del', 'di', 'du', 'la', 'le']);

/**
 * Derives `first_name` from `name` (§6.1 item 5).
 *
 * Persisted at import time and NEVER recomputed at send time, for two reasons: it is what the
 * merge-field render reads on the hot path (§7.4), and the operator has to be told BEFORE dispatching
 * how many contacts will fall back — a count you cannot produce if the value does not exist yet.
 *
 * Returns null when there is nothing usable, and null is the honest answer: it is what feeds
 * `missing_first_name_count` and, later, the `{{primeiro_nome|amigo}}` fallback.
 */
export function deriveFirstName(name: string | null | undefined): string | null {
  const cleaned = (name ?? '')
    // Strip anything that is not a letter, space, hyphen or apostrophe: emojis, digits and
    // punctuation come with exported lists all the time.
    .replace(/[^\p{L}\s'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) {
    return null;
  }

  const words = cleaned.split(' ');
  // "DE SOUZA" or "da Silva" as a full name: the first word is a particle, so take the next real one.
  const first = words.find((word) => !PARTICLES.has(word.toLowerCase())) ?? words[0];

  // A single letter is an initial, not a name — "J. Silva" must fall back rather than greet "J".
  if (first.replace(/[^\p{L}]/gu, '').length < 2) {
    return null;
  }

  return capitalize(first);
}

/**
 * "MARIA" → "Maria", "maria" → "Maria", "MacIntyre" → "MacIntyre".
 *
 * A name that is already mixed-case is left alone: the person wrote it that way. Only all-upper or
 * all-lower gets normalised, because that is an artefact of the spreadsheet, not a choice.
 */
function capitalize(word: string): string {
  const isUniformCase = word === word.toUpperCase() || word === word.toLowerCase();
  if (!isUniformCase) {
    return word;
  }

  return (
    word
      .toLowerCase()
      // Keep the separators (the capturing group) and capitalise every segment between them, so
      // "ana-paula" becomes "Ana-Paula" and "d'avila" becomes "D'Avila" — the Portuguese convention.
      .split(/([-'])/)
      .map((part) => (/^[-']$/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1)))
      .join('')
  );
}
