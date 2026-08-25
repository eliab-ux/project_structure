export const SYSTEM_NOTIFIER = Symbol('SYSTEM_NOTIFIER');

export interface SystemNotification {
  /** Approver name, for the greeting. */
  recipientName: string;
  email: string | null;
  /** E.164 with the leading plus; the adapter strips it for the JID. */
  phoneE164: string | null;
  subject: string;
  /** Plain text. The magic link is inside it — the message carries nothing else (§8 item 4). */
  body: string;
}

export interface SystemNotificationResult {
  emailSent: boolean;
  whatsAppSent: boolean;
  /** Non-empty when a channel failed. The submission still stands; the failure is reported. */
  failures: string[];
}

/**
 * The SYSTEM channel (§8 item 3) — and the reason it is a separate port rather than a flag on the
 * tenant gateway.
 *
 * The rule is absolute: approval notifications go out through the platform's own SMTP and the
 * platform's own dedicated Evolution instance, and **NEVER** through a tenant chip. The spec gives the
 * reason in one line: "Chip de campanha cai; canal de aprovação não pode cair com ele."
 *
 * Making it a distinct port with its own adapter means the approval path has no access to the
 * per-account server resolver at all. There is no argument anyone could pass to route an approval
 * message through a customer's number — the capability simply is not reachable from here.
 */
export interface SystemNotifierPort {
  notify(notification: SystemNotification): Promise<SystemNotificationResult>;
}
