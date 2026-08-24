import {
  HandleBillingWebhookCommand,
  HandleBillingWebhookUseCase,
} from '../../src/contexts/billing/application/use-cases/handle-billing-webhook/handle-billing-webhook.use-case';
import { Charge } from '../../src/contexts/billing/domain/entities/charge.entity';
import { FinancialTitle } from '../../src/contexts/finance/domain/entities/financial-title.entity';
import { SettleTitleCommand } from '../../src/contexts/finance/application/use-cases/settle-title/settle-title.use-case';
import { CreateFinancialTitleCommand } from '../../src/contexts/finance/application/use-cases/create-financial-title/create-financial-title.use-case';
import { BillingWebhookEvent } from '../../src/contexts/billing/application/ports/output/billing-provider.port';
import { UnitOfWorkPort } from '../../src/infrastructure/persistence/ports/unit-of-work.port';

const CONTA = '11111111-1111-4111-8111-111111111111';
const EMPRESA = '22222222-2222-4222-8222-222222222222';
const CLIENTE = '33333333-3333-4333-8333-333333333333';
const CONFIG_ID = 'c0f19000-0000-4000-8000-000000000001';
const CONTA_LIQ = 'f1a90000-0000-4000-8000-000000000001';

const uowFalso: UnitOfWorkPort = { execute: async (fn) => fn() } as UnitOfWorkPort;

function fakes(event: BillingWebhookEvent | null) {
  const title = FinancialTitle.create({
    accountId: CONTA,
    companyId: EMPRESA,
    direction: 'receivable',
    contactId: CLIENTE,
    description: 'Parcela 1/3',
    amount: 250,
    dueDate: new Date('2026-09-01T00:00:00Z'),
  });
  const charge = Charge.create({
    accountId: CONTA,
    companyId: EMPRESA,
    titleId: title.id,
    kind: 'boleto',
    provider: 'asaas',
    providerChargeId: 'prov-123',
  });

  const processed = new Set<string>();
  const settles: SettleTitleCommand[] = [];
  const payables: CreateFinancialTitleCommand[] = [];
  const chargeSaves: Charge[] = [];

  const uc = new HandleBillingWebhookUseCase(
    { parseWebhook: async () => event } as never,
    {
      findById: async () => charge,
      findByProviderChargeId: async (id: string) => (id === 'prov-123' ? charge : null),
      findActiveByTitle: async () => charge,
      list: async () => [charge],
      save: async (c: Charge) => {
        chargeSaves.push(c);
        return c;
      },
    } as never,
    {
      getForAccount: async () => null,
      findById: async (id: string) =>
        id === CONFIG_ID
          ? {
              id: CONFIG_ID,
              accountId: CONTA,
              companyId: null,
              provider: 'asaas',
              encryptedCredentials: 'x',
              agreementCode: null,
              settlementAccountId: CONTA_LIQ,
              active: true,
              createdAt: new Date(),
            }
          : null,
      save: async (c: never) => c,
    } as never,
    {
      registerOnce: async (externalEventId: string) => {
        if (processed.has(externalEventId)) return false;
        processed.add(externalEventId);
        return true;
      },
    } as never,
    { findByDefaultOperation: async () => ({ id: 'cat-tarifa' }) } as never,
    { findById: async () => title, list: async () => [title], save: async (t: never) => t } as never,
    { execute: async (cmd: SettleTitleCommand) => settles.push(cmd) } as never,
    { execute: async (cmd: CreateFinancialTitleCommand) => payables.push(cmd) } as never,
    uowFalso,
  );
  return { uc, settles, payables, chargeSaves, charge };
}

function comando(): HandleBillingWebhookCommand {
  return new HandleBillingWebhookCommand(CONTA, CONFIG_ID, '{}', {});
}

describe('HandleBillingWebhook — baixa automática idempotente (06 §2.2, aceites 2–3)', () => {
  const pago: BillingWebhookEvent = {
    externalEventId: 'evt-1',
    providerChargeId: 'prov-123',
    type: 'paid',
    paidAmount: 250,
    paidAt: new Date('2026-08-30T10:00:00Z'),
    fee: 3.5,
  };

  it('pago → baixa na conta de LIQUIDAÇÃO da config, método = instrumento, tarifa vira conta a pagar', async () => {
    const { uc, settles, payables, charge } = fakes(pago);
    const result = await uc.execute(comando());

    expect(result.outcome).toBe('settled');
    expect(charge.status).toBe('paid');
    expect(settles).toHaveLength(1);
    expect(settles[0].input.financialAccountId).toBe(CONTA_LIQ);
    expect(settles[0].input.method).toBe('boleto');
    expect(settles[0].input.principal).toBe(250);
    // Tarifa do evento → conta a pagar categorizada (árvore do FIN).
    expect(payables).toHaveLength(1);
    expect(payables[0].input.amount).toBe(3.5);
    expect(payables[0].input.categoryId).toBe('cat-tarifa');
  });

  it('a MESMA notificação duas vezes = UMA baixa (aceite 3)', async () => {
    const { uc, settles } = fakes(pago);
    await uc.execute(comando());
    const second = await uc.execute(comando());
    expect(second.outcome).toBe('duplicated');
    expect(settles).toHaveLength(1);
  });

  it('payload que o adapter não reconhece é IGNORADO — nunca 500 (loop de retry do provedor)', async () => {
    const { uc, settles } = fakes(null);
    const result = await uc.execute(comando());
    expect(result.outcome).toBe('ignored');
    expect(settles).toHaveLength(0);
  });

  it('cancelamento no provedor cancela a charge sem tocar o título', async () => {
    const { uc, settles, charge } = fakes({
      externalEventId: 'evt-2',
      providerChargeId: 'prov-123',
      type: 'cancelled',
      paidAmount: null,
      paidAt: null,
      fee: null,
    });
    const result = await uc.execute(comando());
    expect(result.outcome).toBe('cancelled');
    expect(charge.status).toBe('cancelled');
    expect(settles).toHaveLength(0);
  });

  it('sem valor no evento, o principal é o saldo em aberto do título', async () => {
    const { uc, settles } = fakes({ ...pago, externalEventId: 'evt-3', paidAmount: null });
    await uc.execute(comando());
    expect(settles[0].input.principal).toBe(250);
  });
});
