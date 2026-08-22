import { randomUUID } from 'node:crypto';
import { AggregateRoot } from '@gitspread/domain-primitives';
import { catalogFieldFor, catalogFor } from '../field-catalog.registry';
import {
  CannotRelaxMandatoryFieldException,
  UnknownConfigurableEntityException,
  UnknownConfigurableFieldException,
} from '../exceptions/field-config-exceptions';

/**
 * Uma linha de configuração de campo — a sobreposição da conta sobre um campo do catálogo.
 *
 * O que ela governa (§3.6): `visible`, `required`, `label`, `order`. O que ela NUNCA governa: a
 * existência do campo (isso é do catálogo, fixo em código). Por isso a validação de existência mora
 * no construtor, não numa camada acima: uma `FieldConfig` só nasce se o par `(entity, field)` existe
 * no catálogo, e a que tentaria afrouxar um campo obrigatório por domínio não nasce (DECISÃO 2.1).
 *
 * `visible` e `required` são valores explícitos, não "null = herda". A ausência de HERANÇA é o
 * ponto: uma linha existe justamente para SOBRESCREVER o default do catálogo. Campo sem linha usa o
 * default do catálogo — e essa é a decisão (b) já tomada para o Contato, resolvida no merge
 * (`effective-field.ts`), não aqui.
 */
export class FieldConfig extends AggregateRoot {
  private constructor(
    private readonly _id: string,
    private readonly _accountId: string,
    private readonly _entity: string,
    private readonly _field: string,
    private _visible: boolean,
    private _required: boolean,
    private _label: string | null,
    private _sortOrder: number | null,
    private readonly _createdAt: Date,
  ) {
    super();
  }

  static create(params: {
    accountId: string;
    entity: string;
    field: string;
    visible: boolean;
    required: boolean;
    label?: string | null;
    sortOrder?: number | null;
  }): FieldConfig {
    FieldConfig.assertConfigurable(params.entity, params.field, params.visible, params.required);
    return new FieldConfig(
      randomUUID(),
      params.accountId,
      params.entity,
      params.field,
      params.visible,
      params.required,
      params.label?.trim() || null,
      params.sortOrder ?? null,
      new Date(),
    );
  }

  static reconstitute(params: {
    id: string;
    accountId: string;
    entity: string;
    field: string;
    visible: boolean;
    required: boolean;
    label: string | null;
    sortOrder: number | null;
    createdAt: Date;
  }): FieldConfig {
    return new FieldConfig(
      params.id,
      params.accountId,
      params.entity,
      params.field,
      params.visible,
      params.required,
      params.label,
      params.sortOrder,
      params.createdAt,
    );
  }

  /** Reaplica os valores de uma nova configuração, revalidando os invariantes. */
  applyOverride(params: {
    visible: boolean;
    required: boolean;
    label?: string | null;
    sortOrder?: number | null;
  }): void {
    FieldConfig.assertConfigurable(this._entity, this._field, params.visible, params.required);
    this._visible = params.visible;
    this._required = params.required;
    this._label = params.label?.trim() || null;
    this._sortOrder = params.sortOrder ?? null;
  }

  /**
   * O guarda do §3.6 + DECISÃO 2.1, num único ponto. Recusa:
   *  - entidade fora do catálogo (inclui `order`, futura);
   *  - campo fora do catálogo da entidade;
   *  - ocultar ou tornar opcional um campo obrigatório por domínio.
   */
  private static assertConfigurable(
    entity: string,
    field: string,
    visible: boolean,
    required: boolean,
  ): void {
    if (!catalogFor(entity)) {
      throw new UnknownConfigurableEntityException(entity);
    }
    const definition = catalogFieldFor(entity, field);
    if (!definition) {
      throw new UnknownConfigurableFieldException(entity, field);
    }
    if (definition.mandatoryByDomain && (!visible || !required)) {
      throw new CannotRelaxMandatoryFieldException(entity, field);
    }
  }

  get id(): string {
    return this._id;
  }
  get accountId(): string {
    return this._accountId;
  }
  get entity(): string {
    return this._entity;
  }
  get field(): string {
    return this._field;
  }
  get visible(): boolean {
    return this._visible;
  }
  get required(): boolean {
    return this._required;
  }
  get label(): string | null {
    return this._label;
  }
  get sortOrder(): number | null {
    return this._sortOrder;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
}
