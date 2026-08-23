import {
  CommissionTier,
  computeModelACommission,
} from '../../src/contexts/commission/domain/model-a';

// Faixas do exemplo do Eliab (§2 do 02A): 100%→1%, 150%→1,5%, 200%→2%.
const TIERS: CommissionTier[] = [
  { thresholdPercent: 100, commissionPercent: 1 },
  { thresholdPercent: 150, commissionPercent: 1.5 },
  { thresholdPercent: 200, commissionPercent: 2 },
];

describe('Comissão Modelo A — escala de meta, ao centavo (§2 do 02A)', () => {
  it('100% da meta → faixa 1% → 1.000,00', () => {
    const r = computeModelACommission({ vendido: 100000, meta: 100000, tiers: TIERS });
    expect(r.ratioPercent).toBe(100);
    expect(r.appliedThresholdPercent).toBe(100);
    expect(r.commissionValue).toBe(1000);
  });

  it('150% da meta → faixa 1,5% → 2.250,00', () => {
    const r = computeModelACommission({ vendido: 150000, meta: 100000, tiers: TIERS });
    expect(r.ratioPercent).toBe(150);
    expect(r.appliedThresholdPercent).toBe(150);
    expect(r.commissionValue).toBe(2250);
  });

  it('200% da meta → faixa 2% → 4.000,00', () => {
    const r = computeModelACommission({ vendido: 200000, meta: 100000, tiers: TIERS });
    expect(r.commissionValue).toBe(4000);
  });

  it('entre faixas (175%) usa a faixa de baixo (150%) → 2.625,00', () => {
    const r = computeModelACommission({ vendido: 175000, meta: 100000, tiers: TIERS });
    expect(r.appliedThresholdPercent).toBe(150);
    expect(r.commissionValue).toBe(2625);
  });

  it('faixa acima de 100% é ABERTA: 300% cai na maior faixa (200%→2%) → 6.000,00', () => {
    const r = computeModelACommission({ vendido: 300000, meta: 100000, tiers: TIERS });
    expect(r.appliedThresholdPercent).toBe(200);
    expect(r.commissionValue).toBe(6000);
  });

  it('abaixo da menor faixa (90%) → comissão zero', () => {
    const r = computeModelACommission({ vendido: 90000, meta: 100000, tiers: TIERS });
    expect(r.appliedThresholdPercent).toBeNull();
    expect(r.commissionValue).toBe(0);
  });

  it('faixa configurada ABAIXO de 100% comissiona (80%→0,5%) → 450,00', () => {
    const tiers: CommissionTier[] = [
      { thresholdPercent: 80, commissionPercent: 0.5 },
      { thresholdPercent: 100, commissionPercent: 1 },
    ];
    const r = computeModelACommission({ vendido: 90000, meta: 100000, tiers });
    expect(r.appliedThresholdPercent).toBe(80);
    expect(r.commissionValue).toBe(450);
  });

  it('arredonda ao centavo: 1,5% de 33.333,33 = 500,00 (não 499,99...)', () => {
    const r = computeModelACommission({
      vendido: 33333.33,
      meta: 33333.33,
      tiers: [{ thresholdPercent: 100, commissionPercent: 1.5 }],
    });
    expect(r.commissionValue).toBe(500);
  });

  it('sem meta (0) → comissão zero (Modelo A não se apura sem meta)', () => {
    const r = computeModelACommission({ vendido: 100000, meta: 0, tiers: TIERS });
    expect(r.ratioPercent).toBe(0);
    expect(r.commissionValue).toBe(0);
  });
});
