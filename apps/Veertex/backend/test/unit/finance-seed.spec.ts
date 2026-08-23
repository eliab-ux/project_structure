import { SeedFinancialCategoriesUseCase } from '../../src/contexts/finance/application/use-cases/seed-financial-categories/seed-financial-categories.use-case';

const CONTA = '11111111-1111-4111-8111-111111111111';

describe('SeedFinancialCategories — árvore inicial (§2.4 do 05)', () => {
  const seed = new SeedFinancialCategoriesUseCase().build(CONTA);

  it('semeia as categorias da conta com a raiz de receita e as de despesa', () => {
    const names = seed.map((c) => c.name);
    expect(names).toContain('Receita Bruta');
    expect(names).toContain('Impostos');
    expect(names).toContain('Tarifas Bancárias');
    expect(seed.every((c) => c.accountId === CONTA)).toBe(true);
  });

  it('a categoria de venda é receita e default da operação sale', () => {
    const receita = seed.find((c) => c.defaultOperation === 'sale');
    expect(receita?.kind).toBe('revenue');
    expect(receita?.dreLine).toBe('RECEITA_BRUTA');
  });

  it('a categoria de comissão é despesa comercial (default da operação commission)', () => {
    const comissao = seed.find((c) => c.defaultOperation === 'commission');
    expect(comissao?.kind).toBe('expense');
  });

  it('a Transferência é NEUTRA (nunca infla resultado) e default da operação transfer', () => {
    const transferencia = seed.find((c) => c.defaultOperation === 'transfer');
    expect(transferencia?.kind).toBe('neutral');
    expect(transferencia?.name).toBe('Transferência');
  });

  it('cada operação padrão aparece em no máximo uma categoria', () => {
    const ops = seed.map((c) => c.defaultOperation).filter((o) => o !== null);
    expect(new Set(ops).size).toBe(ops.length);
  });
});
