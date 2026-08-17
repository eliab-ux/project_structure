import { AggregateRoot } from '@gitspread/domain-primitives';
import { InvalidValueException } from '../../../../shared/domain/exceptions/invalid-value.exception';
import { AccountId } from '../../../account/domain/value-objects/account-id.vo';
import { FinancialCategoryId } from '../value-objects/finance-ids.vo';

export const CATEGORY_DIRECTIONS = ['in', 'out'] as const;
export type CategoryDirection = (typeof CATEGORY_DIRECTIONS)[number];

export const CATEGORY_DIRECTION_LABELS: Record<CategoryDirection, string> = {
  in: 'Entrada',
  out: 'Saída',
};

/** A categoria da entrada gerada automaticamente ao registrar o pagamento de uma reserva. */
export const MACHINE_HOUR_CATEGORY = 'Hora de máquina';

/**
 * Sementes iniciais da spec (§4.14).
 *
 * "Salários" e "Contratos de prestador" são **apenas categorias de saída** — isto não é folha de
 * pagamento (§4.15). Não há encargo, INSS, FGTS nem holerite em lugar nenhum; o cálculo continua
 * na contabilidade.
 */
export const DEFAULT_CATEGORIES: { name: string; direction: CategoryDirection }[] = [
  { name: MACHINE_HOUR_CATEGORY, direction: 'in' },
  { name: 'Outras entradas', direction: 'in' },
  { name: 'Insumos', direction: 'out' },
  { name: 'Salários', direction: 'out' },
  { name: 'Contratos de prestador', direction: 'out' },
  { name: 'Energia', direction: 'out' },
  { name: 'Manutenção', direction: 'out' },
  { name: 'Taxas e tarifas', direction: 'out' },
];

export class FinancialCategory extends AggregateRoot {
  private constructor(
    private readonly _id: FinancialCategoryId,
    private readonly _accountId: AccountId,
    private _name: string,
    private readonly _direction: CategoryDirection,
    private _isActive: boolean,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
  ) {
    super();
  }

  static create(input: {
    accountId: AccountId;
    name: string;
    direction: string;
  }): FinancialCategory {
    const now = new Date();
    return new FinancialCategory(
      FinancialCategoryId.create(),
      input.accountId,
      FinancialCategory.assertName(input.name),
      FinancialCategory.assertDirection(input.direction),
      true,
      now,
      now,
    );
  }

  static restore(input: {
    id: FinancialCategoryId;
    accountId: AccountId;
    name: string;
    direction: CategoryDirection;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): FinancialCategory {
    return new FinancialCategory(
      input.id,
      input.accountId,
      input.name,
      input.direction,
      input.isActive,
      input.createdAt,
      input.updatedAt,
    );
  }

  /**
   * A direção **não muda**: lançamentos já feitos apontam para esta categoria, e virar uma
   * categoria de saída em entrada inverteria o sinal do histórico inteiro sem tocar em nenhum
   * lançamento.
   */
  update(input: { name: string; isActive: boolean }): void {
    this._name = FinancialCategory.assertName(input.name);
    this._isActive = input.isActive;
    this._updatedAt = new Date();
  }

  private static assertName(name: string): string {
    const value = (name ?? '').trim();
    if (value.length < 2 || value.length > 120) {
      throw new InvalidValueException('Nome da categoria deve ter entre 2 e 120 caracteres.');
    }
    return value;
  }

  private static assertDirection(direction: string): CategoryDirection {
    if (!(CATEGORY_DIRECTIONS as readonly string[]).includes(direction)) {
      throw new InvalidValueException('Direção da categoria deve ser entrada (in) ou saída (out).');
    }
    return direction as CategoryDirection;
  }

  get id(): FinancialCategoryId {
    return this._id;
  }

  get accountId(): AccountId {
    return this._accountId;
  }

  get name(): string {
    return this._name;
  }

  get direction(): CategoryDirection {
    return this._direction;
  }

  get isActive(): boolean {
    return this._isActive;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }
}
