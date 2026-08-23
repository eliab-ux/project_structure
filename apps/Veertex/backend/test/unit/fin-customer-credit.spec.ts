import { CustomerCredit } from '../../src/contexts/finance/domain/entities/customer-credit.entity';

const CONTA = '11111111-1111-4111-8111-111111111111';
const EMPRESA = '22222222-2222-4222-8222-222222222222';
const CLIENTE = '33333333-3333-4333-8333-333333333333';

function credito(amount = 100): CustomerCredit {
  return CustomerCredit.create({
    accountId: CONTA,
    companyId: EMPRESA,
    contactId: CLIENTE,
    originTitleId: null,
    amount,
  });
}

/** Fatia 4 do 05 — DORMENTE até o FIS; as invariantes valem desde já. */
describe('CustomerCredit — crédito do cliente (05 §2.5), invariantes do schema dormente', () => {
  it('não nasce com valor ≤ 0', () => {
    expect(() => credito(0)).toThrow('valor positivo');
    expect(() => credito(-10)).toThrow('valor positivo');
  });

  it('consumo PARCIAL deixa saldo no MESMO crédito (espelho da baixa parcial)', () => {
    const credit = credito(100);
    credit.consume(30);
    expect(credit.remainingAmount).toBe(70);
    expect(credit.status).toBe('open');
    credit.consume(70);
    expect(credit.remainingAmount).toBe(0);
    expect(credit.status).toBe('consumed');
  });

  it('consumo acima do disponível é recusado, nomeando o disponível', () => {
    const credit = credito(50);
    expect(() => credit.consume(60)).toThrow('disponível 50.00');
  });

  it('crédito consumido ou cancelado não se consome de novo', () => {
    const consumido = credito(10);
    consumido.consume(10);
    expect(() => consumido.consume(1)).toThrow('já consumido ou cancelado');

    const cancelado = credito(10);
    cancelado.cancel();
    expect(() => cancelado.consume(1)).toThrow('já consumido ou cancelado');
    expect(() => cancelado.cancel()).toThrow('já consumido ou cancelado');
  });
});
