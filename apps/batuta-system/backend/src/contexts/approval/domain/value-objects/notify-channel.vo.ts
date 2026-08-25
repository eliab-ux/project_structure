/**
 * How an approver is told there is something to review (§8 item 3).
 *
 * Whatever the choice, the message goes out through a SYSTEM channel — the platform own SMTP and the
 * platform dedicated Evolution instance. NEVER a tenant chip: "Chip de campanha cai; canal de
 * aprovação não pode cair com ele."
 */
export enum NotifyChannel {
  EMAIL = 'EMAIL',
  WHATSAPP = 'WHATSAPP',
  BOTH = 'BOTH',
}

export function includesEmail(channel: NotifyChannel): boolean {
  return channel === NotifyChannel.EMAIL || channel === NotifyChannel.BOTH;
}

export function includesWhatsApp(channel: NotifyChannel): boolean {
  return channel === NotifyChannel.WHATSAPP || channel === NotifyChannel.BOTH;
}
