import { CommissionTier } from '../../src/contexts/commission/domain/model-a';
import { computeModelBCommission } from '../../src/contexts/commission/domain/model-b';

// Faixas reais da operação (§2.2 do 02A): ≥90%→8% · 70–89,99%→7% · 50–69,99%→6%.
const TIERS: CommissionTier[] = [
  { thresholdPercent: 90, commissionPercent: 8 },
  { thresholdPercent: 70, commissionPercent: 7 },
  { thresholdPercent: 50, commissionPercent: 6 },
];

describe('Comissão Modelo B — escala de recebimento, MASSA REAL ao centavo (§2.2 do 02A / §3.6 do 04)', () => {
  it('aba 03-07: 96,72% recebido → faixa ≥90% → 8% sobre R$ 46.161,40 = R$ 3.692,91', () => {
    const r = computeModelBCommission({
      recebido: 96.72,
      carteira: 100,
      base: 46161.4,
      tiers: TIERS,
    });
    expect(r.ratioPercent).toBe(96.72);
    expect(r.appliedThresholdPercent).toBe(90);
    expect(r.commissionPercent).toBe(8);
    expect(r.commissionValue).toBe(3692.91);
  });

  it('aba 04-05: faixa 70–89,99% → 7% sobre R$ 52.663,90 = R$ 3.686,47', () => {
    const r = computeModelBCommission({
      recebido: 85,
      carteira: 100,
      base: 52663.9,
      tiers: TIERS,
    });
    expect(r.appliedThresholdPercent).toBe(70);
    expect(r.commissionPercent).toBe(7);
    expect(r.commissionValue).toBe(3686.47);
  });

  it('faixa do meio: 50–69,99% → 6%', () => {
    const r = computeModelBCommission({ recebido: 60, carteira: 100, base: 10000, tiers: TIERS });
    expect(r.appliedThresholdPercent).toBe(50);
    expect(r.commissionValue).toBe(600);
  });

  it('abaixo de 50% de recebimento → comissão zero', () => {
    const r = computeModelBCommission({ recebido: 40, carteira: 100, base: 10000, tiers: TIERS });
    expect(r.appliedThresholdPercent).toBeNull();
    expect(r.commissionValue).toBe(0);
  });

  it('carteira zero → razão zero → sem comissão (não divide por zero)', () => {
    const r = computeModelBCommission({ recebido: 100, carteira: 0, base: 10000, tiers: TIERS });
    expect(r.ratioPercent).toBe(0);
    expect(r.commissionValue).toBe(0);
  });

  it('base padrão é o recebido quando não informada (líquido = recebido)', () => {
    const r = computeModelBCommission({ recebido: 10000, carteira: 10000, tiers: TIERS });
    expect(r.ratioPercent).toBe(100);
    expect(r.commissionValue).toBe(800); // 8% de 10.000
  });
});
