export const CONTACT_USAGE = Symbol('CONTACT_USAGE');

/**
 * What the rest of the system already recorded about a contact.
 *
 * A port rather than a direct import of the dispatch repository, for the same reason
 * `ContactSampleProviderPort` exists in the other direction: the audience context must not depend on
 * another context's persistence. The adapter that fulfils it lives in infrastructure, where crossing
 * contexts is allowed.
 */
export interface ContactUsagePort {
  /** How many sends were planned or made to this contact — 0 means nothing to preserve. */
  countDispatches(contactId: string): Promise<number>;
}
