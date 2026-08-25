import {
  DELIVERED_ACK_STATUSES,
  isDeliveredAck,
} from '../../../src/contexts/distribution/domain/value-objects/delivery-ack.vo';

/**
 * `delivery_rate` is the only proxy §2.1 has for "this number is being blocked", and this classification
 * is what the ratio is built from. Getting it wrong in either direction is expensive:
 *
 *  - too permissive (counting SERVER_ACK) → a blocked chip reports ~100% delivery and the throttle never
 *    reacts, which is the failure the metric exists to prevent;
 *  - too strict → healthy chips report low delivery and every quota gets cut.
 */
describe('isDeliveredAck', () => {
  it('counts acks that prove the message reached the device', () => {
    expect(isDeliveredAck('DELIVERY_ACK')).toBe(true);
    expect(isDeliveredAck('DELIVERED')).toBe(true);
    expect(isDeliveredAck('READ')).toBe(true);
    expect(isDeliveredAck('PLAYED')).toBe(true);
  });

  it('does NOT count SERVER_ACK', () => {
    // The load-bearing case. SERVER_ACK means WhatsApp's server accepted the message, which is exactly
    // what still happens when the recipient has the sender blocked. Counting it would erase the signal.
    expect(isDeliveredAck('SERVER_ACK')).toBe(false);
  });

  it('does not count states that precede delivery or replace it with an error', () => {
    expect(isDeliveredAck('PENDING')).toBe(false);
    expect(isDeliveredAck('ERROR')).toBe(false);
  });

  it('accepts the raw WhatsApp ack codes some Evolution versions send instead of names', () => {
    expect(isDeliveredAck('2')).toBe(true); // delivered to device
    expect(isDeliveredAck('3')).toBe(true); // read
    expect(isDeliveredAck('4')).toBe(true); // played
    expect(isDeliveredAck('1')).toBe(false); // server only
    expect(isDeliveredAck('0')).toBe(false); // pending
  });

  it('treats no ack as not delivered', () => {
    expect(isDeliveredAck(null)).toBe(false);
    expect(isDeliveredAck(undefined)).toBe(false);
    expect(isDeliveredAck('')).toBe(false);
    expect(isDeliveredAck('   ')).toBe(false);
  });

  it('normalises case and surrounding whitespace', () => {
    // The column stores whatever the provider sent, uppercased at write time — but the provider changed
    // its own vocabulary mid-v2, so the reader does not assume the writer already normalised.
    expect(isDeliveredAck('read')).toBe(true);
    expect(isDeliveredAck(' Delivery_Ack ')).toBe(true);
  });

  it('exposes every status already uppercase and trimmed, because SQL compares against it verbatim', () => {
    // The backfill script and the aggregation query both compare `upper(btrim(delivery_status))` to this
    // list. A lowercase or padded entry here would silently match nothing.
    for (const status of DELIVERED_ACK_STATUSES) {
      expect(status).toBe(status.trim().toUpperCase());
    }
  });
});
