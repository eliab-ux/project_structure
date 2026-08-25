import { isOptOutRequest } from '../../../audience/domain/services/opt-out-keywords';
import { IntentClass } from '../value-objects/intent-class.vo';
import { MessageKind } from '../value-objects/message-kind.vo';

/**
 * Words that mean hostility or a complaint. Deliberately short and unambiguous: this list only decides
 * PRIORITY, never an automatic reply, so a false positive costs an operator seeing an ordinary message
 * a few minutes earlier — and a false negative costs an angry person waiting in a queue.
 */
const COMPLAINT_MARKERS = [
  'processo',
  'processar',
  'advogado',
  'procon',
  'denuncia',
  'denunciar',
  'spam',
  'absurdo',
  'inaceitavel',
  'vergonha',
  'ladrao',
  'ladra',
  'mentiroso',
  'mentirosa',
  'palhaco',
  'palhacada',
  'nao autorizei',
  'quem te deu',
  'como conseguiu meu',
  'invasao de privacidade',
  'lgpd',
];

/** "Wrong number" in the shapes Brazilians actually write it. */
const WRONG_NUMBER_MARKERS = [
  'numero errado',
  'nao e meu numero',
  'engano',
  'e engano',
  'pessoa errada',
  'nao sou',
  'nao conheco',
  'quem e voce',
  'quem fala',
  'nao e comigo',
];

/**
 * Short acknowledgements. The rule is that the WHOLE message is one of these — "ok" is an
 * acknowledgement, "ok mas eu queria saber sobre a obra" is a question.
 */
const ACKNOWLEDGMENTS = new Set([
  'ok',
  'okay',
  'oks',
  'blz',
  'beleza',
  'certo',
  'combinado',
  'entendi',
  'ciente',
  'obrigado',
  'obrigada',
  'obg',
  'vlw',
  'valeu',
  'grato',
  'grata',
  'amem',
  'amen',
  'sim',
  'uhum',
  'ata',
  'top',
  'legal',
  'otimo',
  'otima',
  'bom',
  'boa',
  'perfeito',
  'show',
  'joia',
  'tranquilo',
  'de acordo',
  'muito obrigado',
  'muito obrigada',
  'obrigado pela informacao',
  'que bom',
  'parabens',
]);

/** Strips accents, case and punctuation so every list above can be plain ASCII. */
function normalize(text: string | null | undefined): string {
  return (text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface ClassificationInput {
  body: string | null;
  kind: MessageKind;
}

export interface Classification {
  intent: IntentClass;
  /** True when the system resolves it without a human (§10.2: only opt-out and acknowledgement). */
  autoResolvable: boolean;
  /** HIGH puts the item in the separate queue of §10.2. */
  highPriority: boolean;
  /** Which rule fired, for the operator and for the audit trail. */
  matchedRule: string;
}

/**
 * Classifies one inbound message by rule (§10.2 item 4: "por regra (não IA) na v1").
 *
 * Rules, in the order they are tried — and the order IS the design:
 *
 *  1. **OPT_OUT** first, because it is the only class with an irreversible consequence and it must not
 *     be shadowed by anything else. It reuses the §6.5 detector rather than a second implementation:
 *     two lists of opt-out words that drift apart is a way to lose someone's request.
 *  2. **WRONG_NUMBER** before complaint, because "quem é você?" is not hostility and answering it as a
 *     complaint would route an easy fix to the urgent queue.
 *  3. **COMPLAINT** before acknowledgement, because "obrigado, mas vou denunciar" is not an ok.
 *  4. **ACKNOWLEDGMENT** only when the whole message is one — see the list's comment.
 *  5. **QUESTION** when it looks like one, otherwise OTHER. Both go to the human queue; the split
 *     exists so the operator can see at a glance what is waiting.
 *
 * **Audio is never auto-resolved.** §10.2 item 3 puts audio in scope for v1 and transcription out of
 * it, so the system cannot know what a voice note says. Guessing from metadata would be worse than
 * admitting it needs a human — which is what OTHER means here.
 */
export function classifyInbound(input: ClassificationInput): Classification {
  // A media message has no text to classify. It goes to a human, and audio especially so.
  if (input.kind !== MessageKind.TEXT) {
    return {
      intent: IntentClass.OTHER,
      autoResolvable: false,
      highPriority: false,
      matchedRule: `MEDIA_${input.kind}`,
    };
  }

  const raw = input.body ?? '';
  const normalized = normalize(raw);

  if (!normalized) {
    return {
      intent: IntentClass.OTHER,
      autoResolvable: false,
      highPriority: false,
      matchedRule: 'EMPTY_BODY',
    };
  }

  // 1. Opt-out — same detector as §6.5, never a second list.
  if (isOptOutRequest(raw)) {
    return {
      intent: IntentClass.OPT_OUT,
      autoResolvable: true,
      highPriority: false,
      matchedRule: 'OPT_OUT_KEYWORD',
    };
  }

  // 2. Wrong number.
  const wrongNumber = WRONG_NUMBER_MARKERS.find((marker) => normalized.includes(marker));
  if (wrongNumber) {
    return {
      intent: IntentClass.WRONG_NUMBER,
      // Takes the contact out of routing (§10.2), but a human still confirms — see the use case.
      autoResolvable: false,
      highPriority: false,
      matchedRule: `WRONG_NUMBER:${wrongNumber}`,
    };
  }

  // 3. Complaint / hostility.
  const complaint = COMPLAINT_MARKERS.find((marker) => normalized.includes(marker));
  if (complaint) {
    return {
      intent: IntentClass.COMPLAINT,
      autoResolvable: false,
      highPriority: true,
      matchedRule: `COMPLAINT:${complaint}`,
    };
  }

  // 4. Acknowledgement — the whole message, not a word inside it.
  if (ACKNOWLEDGMENTS.has(normalized)) {
    return {
      intent: IntentClass.ACKNOWLEDGMENT,
      // Classified and archived WITHOUT replying (§10.2): answering "obrigado" with "de nada" doubles
      // the traffic of a chip for no gain, and traffic is exactly what gets a number banned.
      autoResolvable: true,
      highPriority: false,
      matchedRule: 'ACKNOWLEDGMENT',
    };
  }
  // Emoji-only messages arrive here with an empty normalisation and were caught above; a short
  // ack followed by an emoji ("ok 👍") normalises to "ok" and is caught by the set.

  // 5. Question or other.
  const looksLikeQuestion =
    raw.includes('?') ||
    /^(quem|qual|quais|quando|onde|como|porque|por que|pra que|quanto|quantos|posso|pode|tem|teria|sera|seria|vai|vao|voce sabe|gostaria de saber)\b/.test(
      normalized,
    );

  return {
    intent: looksLikeQuestion ? IntentClass.QUESTION : IntentClass.OTHER,
    autoResolvable: false,
    highPriority: false,
    matchedRule: looksLikeQuestion ? 'QUESTION' : 'OTHER',
  };
}
