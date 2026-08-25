/**
 * What the provider's ack string means (§2.1, `delivery_rate`).
 *
 * `dispatches.delivery_status` holds whatever the Evolution webhook reported, uppercased and truncated
 * — a free-form string, because the provider changed its own vocabulary mid-v2 and pinning an enum to
 * it would reject acks instead of recording them. The interpretation therefore lives here, in one
 * place, rather than inside whatever SQL happens to be counting deliveries.
 *
 * **`SERVER_ACK` is deliberately NOT delivered.** It means WhatsApp's server accepted the message, which
 * is exactly what still happens when the recipient's number has the sender blocked. Counting it would
 * make `delivery_rate` report ~100% for a chip being blocked — destroying the one signal §2.1 relies on
 * to detect blocking at all. Only an ack that proves the message reached the DEVICE counts.
 *
 * The numeric forms are the raw WhatsApp ack codes, which some Evolution versions send instead of the
 * names: 2 = delivered to device, 3 = read, 4 = played. 0 (pending) and 1 (server) are absent for the
 * reason above.
 */
export const DELIVERED_ACK_STATUSES: readonly string[] = [
  'DELIVERY_ACK',
  'DELIVERED',
  'READ',
  'READ_ACK',
  'PLAYED',
  '2',
  '3',
  '4',
];

/** Whether an ack string means "it reached the recipient's device". Null/empty never does. */
export function isDeliveredAck(status: string | null | undefined): boolean {
  if (!status) {
    return false;
  }
  return DELIVERED_ACK_STATUSES.includes(status.trim().toUpperCase());
}
