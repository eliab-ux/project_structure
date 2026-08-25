/**
 * What an inbound message is about (§4, `conversations.intent_class`; §10.2 item 4).
 *
 * The point of classifying at all: "na prática a maioria do inbound de difusão cai nos três primeiros
 * baldes. O que sobra para humano é uma fração." Three of these six close themselves or route
 * themselves, and that is what makes a large base answerable by a small team.
 */
export enum IntentClass {
  /** Resolves itself through the §6.5 automation. Never reaches the human queue. */
  OPT_OUT = 'OPT_OUT',
  /** "ok", "obrigado", an emoji. Archived WITHOUT replying. */
  ACKNOWLEDGMENT = 'ACKNOWLEDGMENT',
  /** Contact says it is not them. Comes out of routing, and a human confirms. */
  WRONG_NUMBER = 'WRONG_NUMBER',
  /** Hostility or a formal complaint. Separate queue, priority HIGH. */
  COMPLAINT = 'COMPLAINT',
  QUESTION = 'QUESTION',
  OTHER = 'OTHER',
}
