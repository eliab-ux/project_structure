import { computeBalance, MovementForBalance } from '../../src/contexts/stock/domain/stock-balance';

const inMov = (qty: number, cost: number): MovementForBalance => ({
  direction: 'in',
  signedQuantity: qty,
  unitCost: cost,
});
const outMov = (qty: number): MovementForBalance => ({
  direction: 'out',
  signedQuantity: qty,
  unitCost: null,
});
const adjust = (signed: number, cost: number | null = null): MovementForBalance => ({
  direction: 'adjust',
  signedQuantity: signed,
  unitCost: cost,
});

describe('computeBalance — saldo derivado + média móvel (§3.1 / §3.4)', () => {
  it('vazio é zero', () => {
    expect(computeBalance([])).toEqual({ quantity: 0, averageCost: 0 });
  });

  it('uma entrada define quantidade e custo', () => {
    expect(computeBalance([inMov(10, 2)])).toEqual({ quantity: 10, averageCost: 2 });
  });

  it('média ponderada móvel: 10@2 + 10@4 = 20 @ 3', () => {
    expect(computeBalance([inMov(10, 2), inMov(10, 4)])).toEqual({ quantity: 20, averageCost: 3 });
  });

  it('saída não muda a média, só a quantidade', () => {
    expect(computeBalance([inMov(10, 2), outMov(5)])).toEqual({ quantity: 5, averageCost: 2 });
  });

  it('entrada com custo ZERO (bonificação) puxa a média para baixo (§3.4)', () => {
    // 10@2 (média 2) + 10@0 → 20 unidades, (20+0)/20 = 1
    expect(computeBalance([inMov(10, 2), inMov(10, 0)])).toEqual({ quantity: 20, averageCost: 1 });
  });

  it('ajuste negativo reduz a quantidade, média intacta', () => {
    expect(computeBalance([inMov(10, 2), adjust(-3)])).toEqual({ quantity: 7, averageCost: 2 });
  });

  it('ajuste positivo com custo entra na média', () => {
    // 10@2 + ajuste +10@4 = 20 @ 3
    expect(computeBalance([inMov(10, 2), adjust(10, 4)])).toEqual({ quantity: 20, averageCost: 3 });
  });
});
