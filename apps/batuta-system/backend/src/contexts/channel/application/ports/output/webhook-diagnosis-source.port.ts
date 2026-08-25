export const WEBHOOK_DIAGNOSIS_SOURCE = Symbol('WEBHOOK_DIAGNOSIS_SOURCE');

/** What the database knows about inbound on one channel — the half the provider cannot tell us. */
export interface ChannelInboundFacts {
  /** Inbound messages ever recorded for this channel. Zero is the whole question. */
  inboundCount: number;
  lastInboundAt: Date | null;
  contactsTotal: number;
  /**
   * Contacts of this channel whose number has 12 digits instead of 13.
   *
   * A Brazilian mobile in E.164 is 13 digits (55 + 2 DDD + 9 subscriber). Twelve means the ninth digit
   * is missing — and that is the one fault where SENDING works and only the REPLY breaks: WhatsApp
   * delivers to the old form, then reports the JID in canonical form, `findByPhone` misses, and the
   * inbound is dropped as "número desconhecido".
   *
   * Counted, never auto-corrected: a landline is legitimately 12 digits, so this is a suspicion for a
   * human to read, not a rule to apply.
   */
  contactsWithoutNinthDigit: number;
}

/**
 * Reads the inbound side of a channel's health, for the webhook diagnosis.
 *
 * A separate port from the channel repository because it answers a question that spans contexts —
 * `messages` belongs to the inbox, `contacts` to the audience — and the diagnosis's job is to explain
 * the CHAIN, not to own those tables. Read-only by contract: there is no write here to add later.
 *
 * Why it exists at all: the diagnosis used to stop at what the provider reports, so it answered "the
 * webhook is configured" and called that a verdict. A configured webhook with nothing arriving is the
 * exact state that sent us looking through container logs, and this is what ends that.
 */
export interface WebhookDiagnosisSourcePort {
  inboundFacts(channelId: string): Promise<ChannelInboundFacts>;
}
