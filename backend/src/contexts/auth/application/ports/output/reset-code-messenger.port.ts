export const RESET_CODE_MESSENGER = Symbol('RESET_CODE_MESSENGER');

export interface PasswordResetCodeMessage {
  /** E.164 WITH the leading plus; the adapter strips it for the JID. */
  phoneE164: string;
  /** First name only — the message greets, it does not identify. */
  name: string;
  code: string;
  expiresInMinutes: number;
}

/**
 * The channel through which the system talks to a user who cannot log in — the platform's own
 * WhatsApp instance on the Evolution API.
 *
 * A port of its own so that recovery can never be routed through a tenant's number: a customer's
 * chip is paired by the customer, can be disconnected by them and will eventually be throttled.
 * Recovery has to keep working when every one of those is down, which is why the system instance is
 * a separate credential in a separate variable (CLAUDE.md, "Recuperação de Senha por Código").
 *
 * The message TEXT is composed in the adapter, not here: how a channel phrases itself is
 * infrastructure, not a business rule.
 */
export interface ResetCodeMessengerPort {
  /**
   * Throws `RecoveryChannelUnavailableException` when the channel cannot be used at all. Separate
   * from the send, and called BEFORE the user is looked up — see the exception's docblock.
   */
  ensureAvailable(): void;

  sendResetCode(message: PasswordResetCodeMessage): Promise<void>;
}
