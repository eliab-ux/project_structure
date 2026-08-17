import { InvalidValueException } from '../exceptions/invalid-value.exception';

/**
 * Tipo de enfesto. Vocabulário compartilhado entre o pré-pedido (estimativa, §4.7) e a matriz
 * apontada (confirmação no stop, §4.10) — por isso mora no `shared`, e não dentro de um dos dois.
 *
 * `sheet_by_sheet` (folha a folha) corta e volta; `zigzag` (ziguezague) não corta no retorno. A
 * diferença muda o tempo de enfesto, que é o que o histórico por tecido vai medir na Fase 5.
 */
export const LAYOUT_TYPES = ['sheet_by_sheet', 'zigzag'] as const;
export type LayoutType = (typeof LAYOUT_TYPES)[number];

export const LAYOUT_TYPE_LABELS: Record<LayoutType, string> = {
  sheet_by_sheet: 'Folha a folha',
  zigzag: 'Ziguezague',
};

export function assertLayoutType(value: unknown): LayoutType {
  if (typeof value !== 'string' || !(LAYOUT_TYPES as readonly string[]).includes(value)) {
    throw new InvalidValueException('Tipo de enfesto inválido.');
  }
  return value as LayoutType;
}
