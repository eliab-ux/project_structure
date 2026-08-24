import {
  ApproveDunningEventCommand,
  ApproveDunningEventUseCase,
  RunDunningCommand,
  RunDunningUseCase,
} from '../../src/contexts/billing/application/use-cases/dunning/dunning.use-cases';
import { DunningEvent, DunningRule } from '../../src/contexts/billing/domain/entities/dunning-rule.entity';
import { FinancialTitle } from '../../src/contexts/finance/domain/entities/financial-title.entity';
import { UnitOfWorkPort } from '../../src/infrastructure/persistence/ports/unit-of-work.port';

const CONTA = '11111111-1111-4111-8111-111111111111';
const EMPRESA = '22222222-2222-4222-8222-222222222222';
const CLIENTE = '33333333-3333-4333-8333-333333333333';
const AGORA = new Date('2026-08-24T12:00:00Z');
const DIA = 86_400_000;

const uowFalso: UnitOfWorkPort = { execute: async (fn) => fn() } as UnitOfWorkPort;

function titulo(dueOffsetDays: number, amount = 100): FinancialTitle {
  return FinancialTitle.create({
    accountId: CONTA,
    companyId: EMPRESA,
    direction: 'receivable',
    contactId: CLIENTE,
    description: 'Título de teste',
    amount,
    dueDate: new Date(AGORA.getTime() + dueOffsetDays * DIA),
  });
}

function regua(params: {
  steps: { offsetDays: number; channel: 'whatsapp' | 'email'; mode: 'propose' | 'auto' }[];
  maxRebillings?: number;
}): DunningRule {
  return DunningRule.create({
    accountId: CONTA,
    steps: params.steps.map((step) => ({
      ...step,
      template: 'Olá [NOME], sua parcela de [VALOR] vence em [VENCIMENTO].',
    })),
    maxRebillings: params.maxRebillings ?? 3,
    actorUserId: 'ator-do-optin',
  });
}

function fakes(rule: DunningRule, titles: FinancialTitle[]) {
  const events: DunningEvent[] = [];
  const sent: { channel: string; to: string; message: string }[] = [];
  const savedTitles: FinancialTitle[] = [];
  const uc = new RunDunningUseCase(
    { getForAccount: async () => rule, save: async (r: DunningRule) => r } as never,
    {
      findById: async (id: string) => events.find((event) => event.id === id) ?? null,
      listByTitle: async (titleId: string) => events.filter((event) => event.titleId === titleId),
      list: async () => events,
      save: async (event: DunningEvent) => {
        const index = events.findIndex((existing) => existing.id === event.id);
        if (index >= 0) events[index] = event;
        else events.push(event);
        return event;
      },
    } as never,
    {
      findById: async () => null,
      list: async () => titles,
      save: async (title: FinancialTitle) => {
        savedTitles.push(title);
        return title;
      },
    } as never,
    {
      findByContactId: async () => ({
        name: 'Maria',
        document: null,
        email: 'maria@x.com',
        whatsapp: '5562999990000',
      }),
    } as never,
    {
      send: async (params: { channel: string; to: string; message: string }) => {
        sent.push(params);
      },
    } as never,
    uowFalso,
  );
  return { uc, events, sent, savedTitles };
}

describe('RunDunning — a régua (06 §2.3) e a política perdida (04 §3.4)', () => {
  it('modo PROPOSE (default do produto): etapa devida vira proposta — NADA sai sem aprovação', async () => {
    // Vencido há 5 dias; etapa +3 devida, etapa -2 (antes) já passou, etapa +10 ainda não.
    const rule = regua({
      steps: [
        { offsetDays: -2, channel: 'whatsapp', mode: 'propose' },
        { offsetDays: 3, channel: 'whatsapp', mode: 'propose' },
        { offsetDays: 10, channel: 'whatsapp', mode: 'propose' },
      ],
    });
    const { uc, events, sent } = fakes(rule, [titulo(-5)]);
    const result = await uc.execute(new RunDunningCommand(CONTA, AGORA));

    expect(sent).toHaveLength(0); // aceite 4: nenhuma mensagem sem aprovação
    expect(result.proposed).toBe(2); // -2 e +3 devidas; +10 não
    expect(events.every((event) => event.status === 'proposed')).toBe(true);
    // O template foi RESOLVIDO no snapshot (variáveis preenchidas).
    expect(events[0].renderedMessage).toContain('Maria');
    expect(events[0].renderedMessage).not.toContain('[NOME]');
  });

  it('modo AUTO (opt-in registrado): envia AGORA e grava sent', async () => {
    const rule = regua({
      steps: [{ offsetDays: 1, channel: 'whatsapp', mode: 'auto' }],
    });
    const { uc, events, sent } = fakes(rule, [titulo(-3)]);
    const result = await uc.execute(new RunDunningCommand(CONTA, AGORA));

    expect(result.sent).toBe(1);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('5562999990000');
    expect(events[0].status).toBe('sent');
    // O opt-in ficou REGISTRADO na régua (quem ativou).
    expect(rule.steps[0].autoEnabledByUserId).toBe('ator-do-optin');
  });

  it('rodar DUAS vezes não duplica: etapa comum já disparada não dispara de novo', async () => {
    // Offset 0 (no vencimento) = etapa COMUM. Offset positivo único seria a RECOBRANÇA, que
    // repete por desenho — o teste da perdida cobre esse caso.
    const rule = regua({ steps: [{ offsetDays: 0, channel: 'whatsapp', mode: 'propose' }] });
    const { uc, events } = fakes(rule, [titulo(-3)]);
    await uc.execute(new RunDunningCommand(CONTA, AGORA));
    await uc.execute(new RunDunningCommand(CONTA, AGORA));
    expect(events).toHaveLength(1);
  });

  it('PERDIDA: a recobrança repete a cada offset até 1+N; completou sem pagamento → written_off_pending e SAI da régua', async () => {
    // Recobrança = +5 (maior offset positivo); N=1 → 1+1 = 2 passagens.
    const rule = regua({
      steps: [{ offsetDays: 5, channel: 'whatsapp', mode: 'propose' }],
      maxRebillings: 1,
    });
    const vencidoHaMuito = titulo(-30);
    const { uc, events, savedTitles } = fakes(rule, [vencidoHaMuito]);

    // 1ª rodada: passagem 1 (devida em due+5).
    let result = await uc.execute(new RunDunningCommand(CONTA, AGORA));
    expect(result.proposed).toBe(1);
    // 2ª rodada: passagem 2 (devida em due+10 — vencido há 30, já passou).
    result = await uc.execute(new RunDunningCommand(CONTA, AGORA));
    expect(result.proposed).toBe(1);
    expect(events).toHaveLength(2);
    // 3ª rodada: 2 passagens completas sem pagamento → perdida; nenhum evento novo (aceite 5).
    result = await uc.execute(new RunDunningCommand(CONTA, AGORA));
    expect(result.writtenOffPending).toHaveLength(1);
    expect(savedTitles[0].status).toBe('written_off_pending');
    expect(events).toHaveLength(2);
  });

  it('título ainda não vencido não entra em etapa pós-vencimento', async () => {
    const rule = regua({ steps: [{ offsetDays: 3, channel: 'whatsapp', mode: 'propose' }] });
    const { uc } = fakes(rule, [titulo(+10)]); // vence daqui a 10 dias
    const result = await uc.execute(new RunDunningCommand(CONTA, AGORA));
    expect(result.proposed).toBe(0);
  });
});

describe('ApproveDunningEvent — a aprovação humana é o que faz a mensagem SAIR (06 aceite 4)', () => {
  it('aprova proposta → envia e marca sent', async () => {
    const rule = regua({ steps: [{ offsetDays: 1, channel: 'whatsapp', mode: 'propose' }] });
    const title = titulo(-3);
    const { uc: run, events, sent } = fakes(rule, [title]);
    await run.execute(new RunDunningCommand(CONTA, AGORA));
    expect(events[0].status).toBe('proposed');

    const approve = new ApproveDunningEventUseCase(
      {
        findById: async (id: string) => events.find((event) => event.id === id) ?? null,
        listByTitle: async () => events,
        list: async () => events,
        save: async (event: DunningEvent) => event,
      } as never,
      { findById: async () => title, list: async () => [title], save: async (t: never) => t } as never,
      {
        findByContactId: async () => ({
          name: 'Maria',
          document: null,
          email: null,
          whatsapp: '5562999990000',
        }),
      } as never,
      {
        send: async (params: { channel: string; to: string; message: string }) => {
          sent.push(params);
        },
      } as never,
      uowFalso,
    );

    const result = await approve.execute(new ApproveDunningEventCommand(events[0].id));
    expect(result.status).toBe('sent');
    expect(sent).toHaveLength(1);
  });
});
