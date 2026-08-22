import { Order } from '../../src/contexts/order/domain/entities/order.entity';
import { OrderItem } from '../../src/contexts/order/domain/entities/order-item.entity';
import {
  EmptyOrderException,
  InvalidStatusTransitionException,
  InvoicingNotAvailableException,
} from '../../src/contexts/order/domain/exceptions/order-exceptions';

const CONTA = '11111111-1111-4111-8111-111111111111';
const EMPRESA = '22222222-2222-4222-8222-222222222222';
const CLIENTE = '33333333-3333-4333-8333-333333333333';

function item(overrides: Partial<Parameters<typeof OrderItem.create>[0]> = {}) {
  return OrderItem.create({
    productId: '44444444-4444-4444-8444-444444444444',
    description: 'Produto',
    quantity: 2,
    unitPrice: 10,
    ...overrides,
  });
}

function order(items: OrderItem[], overrides: Record<string, unknown> = {}) {
  return Order.create({
    accountId: CONTA,
    companyId: EMPRESA,
    contactId: CLIENTE,
    number: 1,
    origin: 'balcao',
    items,
    ...overrides,
  });
}

describe('OrderItem — totais e desconto', () => {
  it('líquido = bruto quando não há desconto', () => {
    expect(item().netTotal).toBe(20);
  });

  it('desconto percentual', () => {
    expect(item({ discountPercent: 10 }).netTotal).toBe(18);
  });

  it('desconto em valor tem precedência sobre percentual', () => {
    // bruto 20; valor 5 vence os 10% (=2)
    expect(item({ discountPercent: 10, discountValue: 5 }).netTotal).toBe(15);
  });

  it('desconto não passa do bruto da linha', () => {
    expect(item({ discountValue: 999 }).netTotal).toBe(0);
  });
});

describe('Order — totais', () => {
  it('soma os líquidos das linhas e aplica o desconto de pedido', () => {
    const o = order([item(), item({ unitPrice: 30 })], { discountValue: 10 });
    // itens: 20 + 60 = 80; desconto de pedido 10 → 70
    expect(o.itemsTotal).toBe(80);
    expect(o.total).toBe(70);
  });

  it('hasAnyDiscount enxerga desconto de item OU de pedido', () => {
    expect(order([item()]).hasAnyDiscount).toBe(false);
    expect(order([item({ discountPercent: 5 })]).hasAnyDiscount).toBe(true);
    expect(order([item()], { discountValue: 1 }).hasAnyDiscount).toBe(true);
  });
});

describe('Order — situações (§3.2)', () => {
  it('rascunho → confirmado com itens', () => {
    const o = order([item()]);
    o.confirm();
    expect(o.status).toBe('confirmado');
  });

  it('confirmar pedido vazio é recusado', () => {
    expect(() => order([]).confirm()).toThrow(EmptyOrderException);
  });

  it('confirmado → concluido', () => {
    const o = order([item()]);
    o.confirm();
    o.complete();
    expect(o.status).toBe('concluido');
  });

  it('faturar é bloqueado LOUD no V1 (depende de EST/FIN/FIS)', () => {
    const o = order([item()]);
    o.confirm();
    expect(() => o.invoice()).toThrow(InvoicingNotAvailableException);
  });

  it('transição inválida é recusada (concluir a partir de rascunho)', () => {
    expect(() => order([item()]).complete()).toThrow(InvalidStatusTransitionException);
  });

  it('cancelar a partir de rascunho e de confirmado', () => {
    const rascunho = order([item()]);
    rascunho.cancel();
    expect(rascunho.status).toBe('cancelado');

    const confirmado = order([item()]);
    confirmado.confirm();
    confirmado.cancel();
    expect(confirmado.status).toBe('cancelado');
  });
});
