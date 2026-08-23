import { Injectable } from '@nestjs/common';
import { FinancialCategory } from '../../../domain/entities/financial-category.entity';
import { CategoryKind, CategoryOperation } from '../../../domain/category-kind';

interface SeedSpec {
  name: string;
  kind: CategoryKind;
  dreLine: string | null;
  defaultOperation: CategoryOperation | null;
}

/**
 * Árvore inicial de categorias (§2.4 do 05), inspirada na árvore financeira real absorvida
 * (Bling/OTEC). Nasce no onboarding, como os papéis e os módulos — a conta começa operável, e edita
 * a partir daí. A "Transferência" é **neutra** de propósito: par de lançamentos que jamais infla
 * resultado (a lição da árvore real).
 */
const SEED: readonly SeedSpec[] = [
  { name: 'Receita Bruta', kind: 'revenue', dreLine: 'RECEITA_BRUTA', defaultOperation: 'sale' },
  { name: 'Custo Direto', kind: 'expense', dreLine: 'CUSTO_DIRETO', defaultOperation: 'purchase' },
  { name: 'Custo Indireto', kind: 'expense', dreLine: 'CUSTO_INDIRETO', defaultOperation: null },
  {
    name: 'Despesas Comerciais',
    kind: 'expense',
    dreLine: 'DESPESA_COMERCIAL',
    defaultOperation: 'commission',
  },
  { name: 'Fretes', kind: 'expense', dreLine: 'DESPESA_LOGISTICA', defaultOperation: 'freight' },
  {
    name: 'Tarifas Bancárias',
    kind: 'expense',
    dreLine: 'DESPESA_FINANCEIRA',
    defaultOperation: 'bank_fee',
  },
  { name: 'Impostos', kind: 'expense', dreLine: 'IMPOSTOS', defaultOperation: 'tax' },
  { name: 'Transferência', kind: 'neutral', dreLine: null, defaultOperation: 'transfer' },
];

@Injectable()
export class SeedFinancialCategoriesUseCase {
  /** Puro — monta as categorias do seed para uma conta. A persistência é do chamador (onboarding). */
  build(accountId: string): FinancialCategory[] {
    return SEED.map((spec) =>
      FinancialCategory.create({
        accountId,
        name: spec.name,
        kind: spec.kind,
        dreLine: spec.dreLine,
        defaultOperation: spec.defaultOperation,
      }),
    );
  }
}
