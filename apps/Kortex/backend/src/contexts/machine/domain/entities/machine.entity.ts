import { AggregateRoot } from '@gitspread/domain-primitives';
import { InvalidValueException } from '../../../../shared/domain/exceptions/invalid-value.exception';
import { Money } from '../../../../shared/domain/value-objects/money.vo';
import { AccountId } from '../../../account/domain/value-objects/account-id.vo';
import { MachineId } from '../value-objects/machine-id.vo';

/**
 * Uma máquina de corte. **O preço da hora é dela**, não da conta (spec §4.2, decisão 2.9): a
 * operação tem máquinas diferentes com valores diferentes, e uma mesa manual não custa o mesmo
 * que uma Audaces.
 *
 * Mudar o preço aqui **não** altera reserva já criada — cada reserva grava o próprio snapshot no
 * momento da venda (Fase 4). Por isso a entidade não guarda histórico de preço: quem precisa do
 * valor de ontem é a reserva de ontem, e ela já o tem.
 *
 * Máquina inativa não aceita reserva nova, mas continua existindo: o histórico dela é o que
 * alimenta o relatório do mês em que ela ainda rodava.
 */
export class Machine extends AggregateRoot {
  private constructor(
    private readonly _id: MachineId,
    private readonly _accountId: AccountId,
    private _name: string,
    private _model: string | null,
    private _hourPrice: Money,
    private _isActive: boolean,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
  ) {
    super();
  }

  static create(input: {
    accountId: AccountId;
    name: string;
    model?: string | null;
    hourPrice: Money;
  }): Machine {
    const now = new Date();
    return new Machine(
      MachineId.create(),
      input.accountId,
      Machine.assertName(input.name),
      Machine.normalizeModel(input.model),
      input.hourPrice,
      true,
      now,
      now,
    );
  }

  static restore(input: {
    id: MachineId;
    accountId: AccountId;
    name: string;
    model: string | null;
    hourPrice: Money;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): Machine {
    return new Machine(
      input.id,
      input.accountId,
      input.name,
      input.model,
      input.hourPrice,
      input.isActive,
      input.createdAt,
      input.updatedAt,
    );
  }

  rename(name: string): void {
    this._name = Machine.assertName(name);
    this.touch();
  }

  changeModel(model: string | null): void {
    this._model = Machine.normalizeModel(model);
    this.touch();
  }

  changeHourPrice(hourPrice: Money): void {
    this._hourPrice = hourPrice;
    this.touch();
  }

  activate(): void {
    this._isActive = true;
    this.touch();
  }

  deactivate(): void {
    this._isActive = false;
    this.touch();
  }

  private touch(): void {
    this._updatedAt = new Date();
  }

  private static assertName(name: string): string {
    const value = (name ?? '').trim();
    if (value.length < 2 || value.length > 200) {
      throw new InvalidValueException('Nome da máquina deve ter entre 2 e 200 caracteres.');
    }
    return value;
  }

  private static normalizeModel(model: string | null | undefined): string | null {
    const value = (model ?? '').trim();
    if (!value) {
      return null;
    }
    if (value.length > 200) {
      throw new InvalidValueException('Modelo da máquina deve ter no máximo 200 caracteres.');
    }
    return value;
  }

  get id(): MachineId {
    return this._id;
  }

  get accountId(): AccountId {
    return this._accountId;
  }

  get name(): string {
    return this._name;
  }

  get model(): string | null {
    return this._model;
  }

  get hourPrice(): Money {
    return this._hourPrice;
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
