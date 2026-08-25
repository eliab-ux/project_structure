import { ConfigService } from '@nestjs/config';
import { ThrottleConfig } from '../../../src/config/throttle.config';
import {
  GetHealthPanelUseCase,
  HealthPanelDto,
} from '../../../src/contexts/audit/application/use-cases/get-health-panel/get-health-panel.use-case';
import { GetHealthPanelQuery } from '../../../src/contexts/audit/application/use-cases/get-health-panel/get-health-panel.query';
import {
  ChannelHealthRow,
  HealthPanelData,
  HealthPanelSourcePort,
} from '../../../src/contexts/audit/application/ports/output/audit-query.port';

/**
 * The regression this file exists for.
 *
 * A chip with a handful of sends and no delivery acks counted was reported as
 * "Só 0% das mensagens foram entregues — perfil de número sendo bloqueado" — a verdict about the
 * NUMBER, produced by a metric that had no sample behind it. The throttle refused to act on the same
 * numbers (`minSampleForDecision`), so the screen was accusing while the engine was holding.
 *
 * The rule under test: rate-based verdicts require the throttle's own minimum sample; raw counts do not.
 */

/** Defaults of ThrottleConfig, i.e. minSampleForDecision = 20, lowDeliveryRate = 0.85. */
const throttleConfig = new ThrottleConfig(new ConfigService({}));

function row(overrides: Partial<ChannelHealthRow> = {}): ChannelHealthRow {
  return {
    channelId: 'ch-1',
    label: 'chip eliab',
    status: 'CONNECTED',
    currentQuota: 20,
    quotaFloor: 20,
    quotaCeiling: 150,
    daily: [],
    lastDecision: null,
    sentCount: 100,
    deliveryRate: 0.98,
    inboundRate: 0.1,
    optOutRate: 0,
    failureRate: 0,
    consecutiveFailures: 0,
    ...overrides,
  };
}

function panelOf(...channels: ChannelHealthRow[]): Promise<HealthPanelDto> {
  const source: HealthPanelSourcePort = {
    load: async (windowDays: number): Promise<HealthPanelData> => ({
      windowDays,
      channels,
      inboundPerDay: [],
      optOutsInWindow: 0,
      contactsTotal: 0,
      contactsRoutable: 0,
    }),
  };
  return new GetHealthPanelUseCase(source, throttleConfig).execute(
    new GetHealthPanelQuery('acc-1', 14),
  );
}

describe('health panel — minimum sample before any rate verdict', () => {
  it('does not call a chip at risk over 0% delivery when nothing was really sent', async () => {
    // The exact production shape: three sends, no ack counted at all.
    const panel = await panelOf(row({ sentCount: 3, deliveryRate: 0 }));

    expect(panel.channels[0].assessment).toBe('UNKNOWN');
    expect(panel.channels[0].assessmentReason).toMatch(/Amostra insuficiente/);
    // The old wording was the alarm itself; it must not appear on this sample.
    expect(panel.channels[0].assessmentReason).not.toMatch(/bloqueado/);
  });

  it('EXACTLY zero delivery blames the ack pipeline, not the number', async () => {
    // The correction that mattered: a blocked number still reaches everyone who did NOT block it, so a
    // genuinely blocked chip lands in the middle — never on a clean 0 of 400. Zero over a real sample
    // means nothing is being COUNTED, and accusing the chip sent us hunting a number that was fine.
    const panel = await panelOf(row({ sentCount: 400, deliveryRate: 0 }));

    expect(panel.channels[0].assessment).toBe('WATCH');
    // It must not ACCUSE the number. The words "bloqueio"/"bloqueado" do appear — the sentence exists to
    // explain why this is NOT that — so the assertion targets the old verdict, not the vocabulary.
    expect(panel.channels[0].assessmentReason).not.toMatch(/perfil de número sendo bloqueado/);
    expect(panel.channels[0].assessmentReason).toMatch(/não é bloqueio/);
    expect(panel.channels[0].assessmentReason).toMatch(/MESSAGES_UPDATE/);
    // Still surfaced as something to fix — grey would let a broken ack pipeline sit forever.
    expect(panel.channels[0].assessmentReason).toMatch(/400 envios/);
  });

  it('a low but non-zero delivery IS the blocking signature, and still reports it', async () => {
    // The guard must not become a way of never reporting anything: partial delivery is the real shape
    // of a number being blocked, and it must keep saying so.
    const panel = await panelOf(row({ sentCount: 400, deliveryRate: 0.42 }));

    expect(panel.channels[0].assessment).toBe('AT_RISK');
    expect(panel.channels[0].assessmentReason).toMatch(/bloqueado/);
    // The sample belongs in the sentence: "42% de 400" is the claim, not just "42%".
    expect(panel.channels[0].assessmentReason).toMatch(/400/);
  });

  it('treats the threshold as inclusive — exactly the minimum sample is enough to judge', async () => {
    const panel = await panelOf(row({ sentCount: 20, deliveryRate: 0.1 }));

    expect(panel.channels[0].assessment).toBe('AT_RISK');
  });

  it('holds a verdict one send below the minimum', async () => {
    const panel = await panelOf(row({ sentCount: 19, deliveryRate: 0.1 }));

    expect(panel.channels[0].assessment).toBe('UNKNOWN');
  });

  it('reports consecutive failures on a tiny sample — a count means the same at any volume', async () => {
    // Raw counts sit IN FRONT of the sample guard: three failures in a row is three failures in a row.
    const panel = await panelOf(row({ sentCount: 4, deliveryRate: 0, consecutiveFailures: 3 }));

    expect(panel.channels[0].assessment).toBe('WATCH');
    expect(panel.channels[0].assessmentReason).toMatch(/circuit breaker/);
  });

  it('reports a disconnected channel as STOPPED regardless of sample', async () => {
    const panel = await panelOf(row({ status: 'DISCONNECTED', sentCount: 0, deliveryRate: null }));

    expect(panel.channels[0].assessment).toBe('STOPPED');
  });

  it('does not flag "only talks, never listens" before there is enough traffic to say so', async () => {
    // inboundRate is a rate too, so it belongs behind the guard — otherwise a brand-new chip that sent
    // twice and got no reply would be told it is the profile that gets banned.
    const panel = await panelOf(row({ sentCount: 5, inboundRate: 0 }));

    expect(panel.channels[0].assessment).toBe('UNKNOWN');
  });

  it('flags "only talks, never listens" once the sample is real', async () => {
    const panel = await panelOf(row({ sentCount: 300, inboundRate: 0 }));

    expect(panel.channels[0].assessment).toBe('WATCH');
    expect(panel.channels[0].assessmentReason).toMatch(/só fala e não ouve/);
  });

  it('carries the sample size through to the DTO', async () => {
    // The field the screen needs to render the denominator next to the rate. Declared-and-never-mapped
    // is a bug this project has already paid for once (sourceUrl), hence an explicit assertion.
    const panel = await panelOf(row({ sentCount: 137 }));

    expect(panel.channels[0].sentCount).toBe(137);
  });

  it('keeps calling a healthy chip healthy', async () => {
    const panel = await panelOf(row());

    expect(panel.channels[0].assessment).toBe('HEALTHY');
  });
});
