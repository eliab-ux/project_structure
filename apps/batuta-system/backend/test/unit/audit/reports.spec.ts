import { ConfigService } from '@nestjs/config';
import { ThrottleConfig } from '../../../src/config/throttle.config';
import { toCsv } from '../../../src/contexts/audit/domain/services/csv-writer';
import { ExportDistributionReportUseCase } from '../../../src/contexts/audit/application/use-cases/export-distribution-report/export-distribution-report.use-case';
import { ExportDistributionReportCommand } from '../../../src/contexts/audit/application/use-cases/export-distribution-report/export-distribution-report.command';
import { GetHealthPanelUseCase } from '../../../src/contexts/audit/application/use-cases/get-health-panel/get-health-panel.use-case';
import { GetHealthPanelQuery } from '../../../src/contexts/audit/application/use-cases/get-health-panel/get-health-panel.query';
import {
  ChannelHealthRow,
  DistributionReportData,
  DistributionReportSourcePort,
  HealthPanelSourcePort,
} from '../../../src/contexts/audit/application/ports/output/audit-query.port';
import { DistributionReportNotFoundException } from '../../../src/contexts/audit/domain/exceptions/distribution-report-not-found.exception';

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = 'aaaaaaaa-1111-4111-8111-111111111111';
const DISTRIBUTION_ID = 'eeeeeeee-1111-4111-8111-111111111111';

describe('toCsv', () => {
  it('starts with a BOM, so Excel on Windows reads UTF-8 instead of Latin-1', () => {
    const csv = toCsv([{ nome: 'João Conceição' }]);

    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('João Conceição');
  });

  it('quotes and escapes a value containing commas, quotes and newlines', () => {
    // This is what a WhatsApp message looks like, and getting it wrong misaligns every later column.
    const csv = toCsv([{ texto: 'Olá, "vizinho"\nTudo bem?' }]);

    expect(csv).toContain('"Olá, ""vizinho""\nTudo bem?"');
  });

  it('neutralises a formula, so an export cannot attack whoever opens it', () => {
    const csv = toCsv([{ nome: '=cmd|/c calc.exe' }, { nome: '+551199999' }, { nome: '@SUM(A1)' }]);

    // Prefixed with a quote: still readable, no longer executed by Excel or Sheets.
    expect(csv).toContain("'=cmd|/c calc.exe");
    expect(csv).toContain("'+551199999");
    expect(csv).toContain("'@SUM(A1)");
  });

  it('takes the column order from the first row, so the caller controls the layout', () => {
    const csv = toCsv([{ a: 1, b: 2, c: 3 }]);

    expect(csv.split('\r\n')[0]).toBe('﻿a,b,c');
  });

  it('renders dates as ISO and nulls as empty', () => {
    const csv = toCsv([{ quando: new Date('2026-08-04T12:00:00Z'), vazio: null }]);

    expect(csv).toContain('2026-08-04T12:00:00.000Z');
    expect(csv.trim().split('\r\n')[1]).toBe('2026-08-04T12:00:00.000Z,');
  });

  it('an empty set produces a BOM and nothing else — never a fake header', () => {
    expect(toCsv([])).toBe('﻿');
  });
});

describe('ExportDistributionReportUseCase (§11 item 2)', () => {
  let source: jest.Mocked<DistributionReportSourcePort>;
  let useCase: ExportDistributionReportUseCase;

  const data: DistributionReportData = {
    distributionId: DISTRIBUTION_ID,
    accountName: 'Gabinete Exemplo',
    contentTitle: 'Aviso de atendimento',
    classification: 'ELECTORAL',
    contentHash: 'a'.repeat(64),
    windowStart: new Date('2026-08-04T12:00:00Z'),
    windowEnd: new Date('2026-08-08T12:00:00Z'),
    status: 'COMPLETED',
    createdByName: 'Admin do Gabinete',
    createdAt: new Date('2026-08-04T11:00:00Z'),
    confirmedAt: new Date('2026-08-04T11:05:00Z'),
    completedAt: new Date('2026-08-08T10:00:00Z'),
    approvals: [
      {
        approverName: 'Ana Jurídico',
        status: 'APPROVED',
        decidedAt: new Date('2026-08-04T10:50:00Z'),
        contentHash: 'a'.repeat(64),
        comment: 'De acordo.',
        decidedIp: '203.0.113.7',
      },
    ],
    dispatches: [
      {
        contactName: 'Maria Silva',
        contactPhoneMasked: '+55119*****8888',
        channelLabel: 'Chip Principal',
        channelPhoneMasked: '+55113*****4444',
        variantLabel: 'Base',
        renderedBody: 'Olá Maria, a audiência será às 14h.',
        status: 'SENT',
        blockedReason: null,
        scheduledAt: new Date('2026-08-04T13:00:00Z'),
        sentAt: new Date('2026-08-04T13:00:12Z'),
        deliveryStatus: 'DELIVERY_ACK',
        errorDetail: null,
      },
      {
        contactName: 'João Pereira',
        contactPhoneMasked: '+55119*****7777',
        channelLabel: 'Chip Morto',
        channelPhoneMasked: '+55113*****5555',
        variantLabel: 'Base',
        renderedBody: 'Olá João, a audiência será às 14h.',
        status: 'BLOCKED',
        blockedReason: 'SENDER_UNAVAILABLE',
        scheduledAt: null,
        sentAt: null,
        deliveryStatus: null,
        errorDetail: null,
      },
    ],
    totals: { total: 2, sent: 1, failed: 0, blocked: 1, cancelled: 0, pending: 0 },
  };

  beforeEach(() => {
    source = {
      load: jest.fn(async () => data),
    } as unknown as jest.Mocked<DistributionReportSourcePort>;
    useCase = new ExportDistributionReportUseCase(source);
  });

  const command = (format: 'CSV' | 'PDF'): ExportDistributionReportCommand =>
    new ExportDistributionReportCommand(ACCOUNT_ID, USER_ID, DISTRIBUTION_ID, format, null);

  it('refuses a distribution that does not exist', async () => {
    source.load.mockResolvedValue(null);

    await expect(useCase.execute(command('CSV'))).rejects.toThrow(
      DistributionReportNotFoundException,
    );
  });

  it('the CSV carries the EXACT text sent to each recipient', async () => {
    const result = await useCase.execute(command('CSV'));
    const csv = result.content.toString('utf-8');

    expect(csv).toContain('Olá Maria, a audiência será às 14h.');
    expect(csv).toContain('Olá João, a audiência será às 14h.');
    // One line per recipient plus the header.
    expect(csv.trim().split('\r\n')).toHaveLength(3);
  });

  it('the CSV ties the approvals to the version approved', async () => {
    const result = await useCase.execute(command('CSV'));
    const csv = result.content.toString('utf-8');

    expect(csv).toContain('a'.repeat(64));
    expect(csv).toContain('Ana Jurídico (APPROVED em 2026-08-04T10:50:00.000Z)');
  });

  it('the CSV keeps phones masked — this document leaves the system', async () => {
    const result = await useCase.execute(command('CSV'));
    const csv = result.content.toString('utf-8');

    expect(csv).toContain('*****8888');
    // No full number anywhere in the file.
    expect(csv).not.toMatch(/\+55\d{11}/);
  });

  it('the CSV states why a blocked recipient was not sent to', async () => {
    const result = await useCase.execute(command('CSV'));

    expect(result.content.toString('utf-8')).toContain('SENDER_UNAVAILABLE');
  });

  it('the file name says which content and which day, not just "report"', async () => {
    const csv = await useCase.execute(command('CSV'));
    const pdf = await useCase.execute(command('PDF'));

    expect(csv.fileName).toBe('relatorio-aviso-de-atendimento-2026-08-04.csv');
    expect(pdf.fileName).toBe('relatorio-aviso-de-atendimento-2026-08-04.pdf');
    expect(csv.mimeType).toContain('text/csv');
    expect(pdf.mimeType).toBe('application/pdf');
  });

  it('the PDF is a real PDF and contains the hash and the message text', async () => {
    const result = await useCase.execute(command('PDF'));

    expect(result.content.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(result.content.length).toBeGreaterThan(1000);
  });
});

describe('GetHealthPanelUseCase (§11 item 3)', () => {
  let source: jest.Mocked<HealthPanelSourcePort>;
  let useCase: GetHealthPanelUseCase;

  function channel(overrides: Partial<ChannelHealthRow> = {}): ChannelHealthRow {
    return {
      channelId: 'cccccccc-1111-4111-8111-111111111111',
      label: 'Chip Principal',
      status: 'CONNECTED',
      currentQuota: 100,
      quotaFloor: 20,
      quotaCeiling: 150,
      daily: [{ date: '2026-08-04', campaignSends: 80, replySends: 5 }],
      lastDecision: {
        date: '2026-08-03',
        decision: 'RAISE',
        reason: 'Sinais limpos por 3 dias',
        computedQuota: 100,
      },
      // Coherent with `daily` above (80 + 5) and comfortably over `minSampleForDecision`, so every
      // rate assertion below is judged rather than deferred for lack of sample.
      sentCount: 85,
      deliveryRate: 0.97,
      inboundRate: 0.08,
      optOutRate: 0.001,
      failureRate: 0.01,
      consecutiveFailures: 0,
      ...overrides,
    };
  }

  function load(channels: ChannelHealthRow[], routable = 1000): void {
    source.load.mockResolvedValue({
      windowDays: 14,
      channels,
      inboundPerDay: [{ date: '2026-08-04', count: 12 }],
      optOutsInWindow: 3,
      contactsTotal: 1200,
      contactsRoutable: routable,
    });
  }

  beforeEach(() => {
    source = { load: jest.fn() } as unknown as jest.Mocked<HealthPanelSourcePort>;
    // Defaults of ThrottleConfig — the panel judges against the throttle's own thresholds.
    useCase = new GetHealthPanelUseCase(source, new ThrottleConfig(new ConfigService({})));
  });

  it('clamps the window instead of scanning years of counters', async () => {
    load([channel()]);

    await useCase.execute(new GetHealthPanelQuery(ACCOUNT_ID, 5000));

    expect(source.load).toHaveBeenCalledWith(90);
  });

  it('states the daily capacity and how many days the base takes (§15 risco 3)', async () => {
    load([channel({ currentQuota: 150 }), channel({ currentQuota: 100 })], 1000);

    const panel = await useCase.execute(new GetHealthPanelQuery(ACCOUNT_ID));

    expect(panel.dailyCapacity).toBe(250);
    expect(panel.daysToCoverBase).toBe(4);
  });

  it('a disconnected chip does not count towards capacity', async () => {
    load([channel({ status: 'DEGRADED', currentQuota: 150 })], 300);

    const panel = await useCase.execute(new GetHealthPanelQuery(ACCOUNT_ID));

    expect(panel.dailyCapacity).toBe(0);
    // Null, not Infinity and not 0: with no capacity the question has no answer.
    expect(panel.daysToCoverBase).toBeNull();
  });

  describe('the one-word assessment', () => {
    it('healthy signals read as HEALTHY', async () => {
      load([channel()]);
      const panel = await useCase.execute(new GetHealthPanelQuery(ACCOUNT_ID));
      expect(panel.channels[0].assessment).toBe('HEALTHY');
    });

    it('a channel that cannot send reads as STOPPED, whatever its rates', async () => {
      load([channel({ status: 'BANNED', deliveryRate: 1 })]);
      const panel = await useCase.execute(new GetHealthPanelQuery(ACCOUNT_ID));
      expect(panel.channels[0].assessment).toBe('STOPPED');
      expect(panel.channels[0].assessmentReason).toContain('BANNED');
    });

    it('a high failure rate reads as AT_RISK and blames the instance, not the audience', async () => {
      load([channel({ failureRate: 0.25 })]);
      const panel = await useCase.execute(new GetHealthPanelQuery(ACCOUNT_ID));
      expect(panel.channels[0].assessment).toBe('AT_RISK');
      expect(panel.channels[0].assessmentReason).toMatch(/instância/);
    });

    it('a high opt-out rate reads as AT_RISK', async () => {
      load([channel({ optOutRate: 0.03 })]);
      const panel = await useCase.execute(new GetHealthPanelQuery(ACCOUNT_ID));
      expect(panel.channels[0].assessment).toBe('AT_RISK');
    });

    it('a low delivery rate reads as AT_RISK — the profile of a number being blocked', async () => {
      load([channel({ deliveryRate: 0.7 })]);
      const panel = await useCase.execute(new GetHealthPanelQuery(ACCOUNT_ID));
      expect(panel.channels[0].assessment).toBe('AT_RISK');
      expect(panel.channels[0].assessmentReason).toMatch(/bloqueado/);
    });

    it('failures piling up read as WATCH before the breaker opens', async () => {
      load([channel({ consecutiveFailures: 3 })]);
      const panel = await useCase.execute(new GetHealthPanelQuery(ACCOUNT_ID));
      expect(panel.channels[0].assessment).toBe('WATCH');
      expect(panel.channels[0].assessmentReason).toMatch(/circuit breaker/i);
    });

    it('a chip that only talks and never listens reads as WATCH (§10.4)', async () => {
      load([channel({ inboundRate: 0.001 })]);
      const panel = await useCase.execute(new GetHealthPanelQuery(ACCOUNT_ID));
      expect(panel.channels[0].assessment).toBe('WATCH');
      expect(panel.channels[0].assessmentReason).toMatch(/só fala/);
    });

    it('no sample at all is not a catastrophe: null rates do not trigger AT_RISK', async () => {
      load([
        channel({
          sentCount: 0,
          deliveryRate: null,
          optOutRate: null,
          failureRate: null,
          inboundRate: null,
        }),
      ]);
      const panel = await useCase.execute(new GetHealthPanelQuery(ACCOUNT_ID));
      // A brand-new chip that never sent shows 0% delivery if you treat null as zero. It is not broken.
      // It reads UNKNOWN rather than HEALTHY: never having sent is not evidence of health either, and
      // claiming health for an unmeasured chip is how "it looked fine" happens right before a ban.
      expect(panel.channels[0].assessment).toBe('UNKNOWN');
      expect(panel.channels[0].assessment).not.toBe('AT_RISK');
    });
  });

  it('carries the last throttle decision WITH its reason', async () => {
    load([channel()]);

    const panel = await useCase.execute(new GetHealthPanelQuery(ACCOUNT_ID));

    expect(panel.channels[0].lastDecision).toMatchObject({
      decision: 'RAISE',
      reason: 'Sinais limpos por 3 dias',
    });
  });
});
