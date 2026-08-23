import { OrderPayment } from '../../src/contexts/order/domain/entities/order-payment.entity';
import { InvalidPaymentAmountException } from '../../src/contexts/order/domain/exceptions/order-exceptions';

const CONTA = '11111111-1111-4111-8111-111111111111';
const PEDIDO = '22222222-2222-4222-8222-222222222222';

/**
 * order_payment é DORMENTE (§4.1 do 02A) — o schema nasce pronto para o PDV/TEF. Estes testes
 * cobrem só as invariantes da entidade que já existe; não há fluxo de captura no V1.
 */
describe('OrderPayment — invariantes da entidade dormente (§4.1 do 02A)', () => {
  it('cria pagamento com forma, valor e parcelas (default 1)', () => {
    const p = OrderPayment.create({
      accountId: CONTA,
      orderId: PEDIDO,
      method: 'dinheiro',
      amount: 100,
    });
    expect(p.method).toBe('dinheiro');
    expect(p.amount).toBe(100);
    expect(p.installments).toBe(1);
    expect(p.tef).toBeNull();
  });

  it('pagamento misto = N linhas por pedido (dinheiro + cartão)', () => {
    const dinheiro = OrderPayment.create({
      accountId: CONTA,
      orderId: PEDIDO,
      method: 'dinheiro',
      amount: 50,
    });
    const cartao = OrderPayment.create({
      accountId: CONTA,
      orderId: PEDIDO,
      method: 'cartao_credito',
      amount: 150,
      installments: 3,
    });
    expect(dinheiro.orderId).toBe(cartao.orderId);
    expect(cartao.installments).toBe(3);
  });

  it('valor não-positivo é recusado', () => {
    expect(() =>
      OrderPayment.create({ accountId: CONTA, orderId: PEDIDO, method: 'pix', amount: 0 }),
    ).toThrow(InvalidPaymentAmountException);
  });

  it('bloco TEF é preservado quando informado (dormente, mas pronto)', () => {
    const p = OrderPayment.create({
      accountId: CONTA,
      orderId: PEDIDO,
      method: 'cartao_debito',
      amount: 200,
      tef: {
        provider: 'stone',
        nsu: '123',
        authorization: 'AUTH',
        brand: 'visa',
        status: 'approved',
        payload: '{}',
        acquirerCnpj: '12345678000199',
      },
    });
    expect(p.tef?.nsu).toBe('123');
    expect(p.tef?.acquirerCnpj).toBe('12345678000199');
  });
});
