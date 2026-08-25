/**
 * Why we are allowed to message these people (§6.1 item 6).
 *
 * Mandatory on every import, with no default: "É campo de banco, não burocracia — é o que permite
 * responder de onde veio a lista." When someone asks where a number came from, this plus
 * `origin_note` is the answer.
 */
export enum ConsentBasis {
  /** Explicit opt-in: signed a form, ticked a box, sent a message asking to be added. */
  EXPLICIT_OPT_IN = 'EXPLICIT_OPT_IN',
  /** Existing relationship: constituent service, prior customer, member of the office base. */
  EXISTING_RELATIONSHIP = 'EXISTING_RELATIONSHIP',
  /** Publicly available source, recorded in origin_note. */
  PUBLIC_SOURCE = 'PUBLIC_SOURCE',
  /** Given by a third party, whose identity goes in origin_note. */
  THIRD_PARTY = 'THIRD_PARTY',
}
