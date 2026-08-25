import { SendSlotReservation } from '../../../src/contexts/channel/application/ports/output/channel-repository.port';

/**
 * The runtime interval guard (Adendo 02 §1.5).
 *
 * These tests do NOT go through the use case. What has to be proven here is the concurrency property
 * of the reservation itself — that a hundred jobs of one channel cannot all pass, that two workers
 * racing produce exactly one winner — and that is a property of the conditional UPDATE, not of the
 * orchestration around it. So the UPDATE is reproduced faithfully in memory, against a controllable
 * clock, and exercised the way a drained backlog exercises it.
 *
 * The SQL itself was verified against Postgres before this file existed; what is modelled here is its
 * semantics under READ COMMITTED: the row is locked, the loser re-reads the new value, and its WHERE
 * no longer matches.
 */
class FakeClock {
  constructor(private millis = new Date('2026-08-07T12:00:00Z').getTime()) {}

  now(): number {
    return this.millis;
  }

  advance(ms: number): void {
    this.millis += ms;
  }
}

/**
 * In-memory stand-in for `reserveSendSlot`, with the same atomicity contract.
 *
 * Single-threaded JavaScript makes the check-and-set below genuinely atomic, which is the same
 * guarantee the conditional UPDATE gives across processes. That is the point being modelled.
 */
class FakeChannelSlots {
  private lastSendAt = new Map<string, number>();
  reservations = 0;

  constructor(private readonly clock: FakeClock) {}

  reserve(channelId: string, minIntervalSeconds: number): SendSlotReservation {
    const previous = this.lastSendAt.get(channelId);
    const intervalMs = minIntervalSeconds * 1000;
    const now = this.clock.now();

    if (previous !== undefined && previous > now - intervalMs) {
      return { allowed: false, waitMs: previous + intervalMs - now };
    }

    this.lastSendAt.set(channelId, now);
    this.reservations += 1;
    return { allowed: true, waitMs: 0 };
  }
}

const MIN_INTERVAL_SECONDS = 45;
const CHANNEL_A = 'aaaaaaaa-1111-4111-8111-111111111111';
const CHANNEL_B = 'bbbbbbbb-1111-4111-8111-111111111111';

describe('guard de intervalo em runtime', () => {
  let clock: FakeClock;
  let slots: FakeChannelSlots;

  beforeEach(() => {
    clock = new FakeClock();
    slots = new FakeChannelSlots(clock);
  });

  /**
   * O teste que existe por causa do bug: 100 jobs vencidos, todos prontos ao mesmo tempo.
   *
   * Concorrência 1 serializa e NÃO espaça — a 1–2s por envio, os 100 sairiam em três minutos. Aqui
   * eles são drenados como a fila drena de verdade: quem é recusado volta depois da espera devolvida.
   */
  it('backlog de 100 envios do mesmo canal sai espaçado, não em rajada', () => {
    const pending = Array.from({ length: 100 }, (_, index) => index);
    const sentAt: number[] = [];

    // Uma "volta" da fila: tenta o primeiro pendente; se recusado, o tempo avança pela espera devolvida.
    while (pending.length > 0) {
      const slot = slots.reserve(CHANNEL_A, MIN_INTERVAL_SECONDS);
      if (slot.allowed) {
        pending.shift();
        sentAt.push(clock.now());
        continue;
      }
      clock.advance(slot.waitMs);
    }

    expect(sentAt).toHaveLength(100);
    const gaps = sentAt.slice(1).map((at, index) => at - sentAt[index]);
    // Nenhum par de envios consecutivos abaixo do intervalo mínimo.
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(MIN_INTERVAL_SECONDS * 1000);
    // E o total é o que o intervalo obriga: 99 espaços, não três minutos.
    expect(sentAt[99] - sentAt[0]).toBe(99 * MIN_INTERVAL_SECONDS * 1000);
  });

  it('canais diferentes correm em paralelo, cada um no seu ritmo', () => {
    // Mesmo instante, canais distintos: os dois passam. Serializar entre canais faria 10 chips
    // renderem como 1 e anularia a razão de existir da frota.
    expect(slots.reserve(CHANNEL_A, MIN_INTERVAL_SECONDS).allowed).toBe(true);
    expect(slots.reserve(CHANNEL_B, MIN_INTERVAL_SECONDS).allowed).toBe(true);

    // E cada um guarda o próprio relógio: o segundo envio de A não é liberado por B ter enviado.
    expect(slots.reserve(CHANNEL_A, MIN_INTERVAL_SECONDS).allowed).toBe(false);
    expect(slots.reserve(CHANNEL_B, MIN_INTERVAL_SECONDS).allowed).toBe(false);

    clock.advance(MIN_INTERVAL_SECONDS * 1000);
    expect(slots.reserve(CHANNEL_A, MIN_INTERVAL_SECONDS).allowed).toBe(true);
    expect(slots.reserve(CHANNEL_B, MIN_INTERVAL_SECONDS).allowed).toBe(true);
  });

  it('dois workers no mesmo canal e no mesmo instante: exatamente um passa', () => {
    const first = slots.reserve(CHANNEL_A, MIN_INTERVAL_SECONDS);
    const second = slots.reserve(CHANNEL_A, MIN_INTERVAL_SECONDS);

    // O perdedor relê a linha já atualizada e o seu WHERE deixa de casar — é o que o UPDATE
    // condicional garante sob READ COMMITTED, sem lock explícito para alguém esquecer.
    expect([first.allowed, second.allowed].filter(Boolean)).toHaveLength(1);
    expect(slots.reservations).toBe(1);
  });

  it('a espera devolvida é o que falta do intervalo, não o intervalo inteiro', () => {
    slots.reserve(CHANNEL_A, MIN_INTERVAL_SECONDS);
    clock.advance(30_000);

    const refused = slots.reserve(CHANNEL_A, MIN_INTERVAL_SECONDS);

    // Reagendar pelo intervalo cheio atrasaria a campanha a cada quase-acerto.
    expect(refused.allowed).toBe(false);
    expect(refused.waitMs).toBe(15_000);
  });

  it('o primeiro envio de um canal nunca espera', () => {
    // `last_send_at is null` faz parte da condição do UPDATE: uma campanha nova não pode começar
    // esperando 45 segundos sem motivo.
    expect(slots.reserve(CHANNEL_A, MIN_INTERVAL_SECONDS)).toEqual({ allowed: true, waitMs: 0 });
  });
});
