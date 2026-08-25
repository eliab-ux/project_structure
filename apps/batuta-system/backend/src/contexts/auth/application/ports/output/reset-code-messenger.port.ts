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
 * A port of its own, separate from the tenant `WhatsappGatewayPort`, for the same reason
 * `SystemNotifierPort` is separate: that gateway is a CUSTOMER's chip, which the customer pairs and
 * can disconnect, and which the throttle can degrade. Recovery must keep working when every chip of
 * the account is down. Making it a distinct port means this path has no reachable code that could
 * route a recovery code through a tenant's number.
 *
 * The message TEXT is composed in the adapter, not here: how a channel phrases itself is
 * infrastructure, not a business rule.
 */
export interface ResetCodeMessengerPort {
  /**
   * Throws `RecoveryChannelUnavailableException` when the channel cannot be used at all.
   *
   * Separate from the send, and called BEFORE the user is looked up: if a broken channel only
   * surfaced at send time, a real e-mail would error while an unknown one answered 204 — exactly
   * the distinction this flow exists to avoid.
   */
  ensureAvailable(): void;

  sendResetCode(message: PasswordResetCodeMessage): Promise<void>;
}
