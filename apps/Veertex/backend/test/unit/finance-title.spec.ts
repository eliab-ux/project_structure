import { computeLateCharges } from '../../src/contexts/finance/domain/late-charges';
import { FinancialTitle } from '../../src/contexts/finance/domain/entities/financial-title.entity';
import { TitleSettlement } from '../../src/contexts/finance/domain/entities/title-settlement.entity';
import {
  TitleClosedException,
  TitleOverSettlementException,
} from '../../src/contexts/finance/domain/exceptions/finance-exceptions';

const CONTA = '11111111-1111-4111-8111-111111111111';
const EMPRESA = '22222222-2222-4222-8222-222222222222';
const CONTA_FIN = '33333333-3333-4333-8333-333333333333';

function receivable(amount: number, dueDate = new Date('2026-08-10T00:00:00Z')): FinancialTitle {
  return FinancialTitle.create({
    accountId: CONTA,
    companyId: EMPRESA,
    direction: 'receivable',
    description: 'Venda',
    amount,
    dueDate,
  });
}

function settlement(principal: number, extra: { interest?: number; fine?: number } = {}) {
  return TitleSettlement.create({
    financialAccountId: CONTA_FIN,
    method: 'pix',
    principal,
    interest: extra.interest,
    fine: extra.fine,
    settledAt: new Date('2026-08-10T00:00:00Z'),
  });
}

describe('Juros e multa por atraso (§2.1 do 05) — FIN calcula', () => {
  it('pago em dia → sem encargo', () => {
    const c = computeLateCharges({
      principal: 1000,
      dueDate: new Date('2026-08-10T00:00:00Z'),
      paidAt: new Date('2026-08-10T00:00:00Z'),
      monthlyInterestPercent: 3,
      finePercent: 2,
    });
    expect(c.interest).toBe(0);
    expect(c.fine).toBe(0);
  });

  it('30 dias de atraso: multa 2% + juros 3%/mês → 20,00 + 30,00 (ao centavo)', () => {
    const c = computeLateCharges({
      principal: 1000,
      dueDate: new Date('2026-08-10T00:00:00Z'),
      paidAt: new Date('2026-09-09T00:00:00Z'), // 30 dias
      monthlyInterestPercent: 3,
      finePercent: 2,
    });
    expect(c.daysLate).toBe(30);
    expect(c.fine).toBe(20);
    expect(c.interest).toBe(30);
  });

  it('15 dias de atraso: juros pro-rata (metade do mês) → 15,00', () => {
    const c = computeLateCharges({
      principal: 1000,
      dueDate: new Date('2026-08-10T00:00:00Z'),
      paidAt: new Date('2026-08-25T00:00:00Z'),
      monthlyInterestPercent: 3,
      finePercent: 0,
    });
    expect(c.daysLate).toBe(15);
    expect(c.interest).toBe(15);
  });
});

describe('FinancialTitle — baixa parcial deixa saldo no MESMO título (§2.1 do 05)', () => {
  it('open → partial → settled, com saldo residual correto', () => {
    const title = receivable(300);
    expect(title.status).toBe('open');
    expect(title.openAmount).toBe(300);

    title.addSettlement(settlement(100));
    expect(title.status).toBe('partial');
    expect(title.openAmount).toBe(200);

    title.addSettlement(settlement(200));
    expect(title.status).toBe('settled');
    expect(title.openAmount).toBe(0);
  });

  it('juros e multa não reduzem o saldo (só o principal)', () => {
    const title = receivable(100);
    title.addSettlement(settlement(100, { interest: 5, fine: 2 }));
    expect(title.openAmount).toBe(0);
    expect(title.settlements[0].cashAmount).toBe(107);
  });

  it('baixa acima do saldo em aberto é recusada', () => {
    const title = receivable(100);
    expect(() => title.addSettlement(settlement(150))).toThrow(TitleOverSettlementException);
  });

  it('título quitado recusa nova baixa', () => {
    const title = receivable(100);
    title.addSettlement(settlement(100));
    expect(() => title.addSettlement(settlement(1))).toThrow(TitleClosedException);
  });
});
