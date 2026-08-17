import { AggregateRoot } from '@gitspread/domain-primitives';
import { InvalidValueException } from '../../../../shared/domain/exceptions/invalid-value.exception';
import { AccountId } from '../value-objects/account-id.vo';
import { ReportOwner } from '../value-objects/report-owner.vo';

/**
 * A conta é o dono da operação — o tenant. Não guarda preço da hora (é de cada máquina, §4.2) nem
 * horário de funcionamento (são as janelas de `business_hour`, §4.1.1).
 *
 * `city` é obrigatória porque é coluna do relatório mensal do governo; uma conta sem cidade só
 * descobre o problema no fechamento do mês, quando não dá mais para perguntar.
 */
export class Account extends AggregateRoot {
  private constructor(
    private readonly _id: AccountId,
    private _name: string,
    private _city: string,
    private _reportOwner: ReportOwner | null,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
  ) {
    super();
  }

  static create(input: { name: string; city: string; reportOwner?: ReportOwner | null }): Account {
    const now = new Date();
    return new Account(
      AccountId.create(),
      Account.assertName(input.name),
      Account.assertCity(input.city),
      input.reportOwner ?? null,
      now,
      now,
    );
  }

  /** Reconstrução a partir da persistência — não valida nem emite evento. */
  static restore(input: {
    id: AccountId;
    name: string;
    city: string;
    reportOwner: ReportOwner | null;
    createdAt: Date;
    updatedAt: Date;
  }): Account {
    return new Account(
      input.id,
      input.name,
      input.city,
      input.reportOwner,
      input.createdAt,
      input.updatedAt,
    );
  }

  rename(name: string): void {
    this._name = Account.assertName(name);
    this.touch();
  }

  changeCity(city: string): void {
    this._city = Account.assertCity(city);
    this.touch();
  }

  changeReportOwner(reportOwner: ReportOwner | null): void {
    this._reportOwner = reportOwner;
    this.touch();
  }

  private touch(): void {
    this._updatedAt = new Date();
  }

  private static assertName(name: string): string {
    const value = (name ?? '').trim();
    if (value.length < 2 || value.length > 200) {
      throw new InvalidValueException('Nome da conta deve ter entre 2 e 200 caracteres.');
    }
    return value;
  }

  private static assertCity(city: string): string {
    const value = (city ?? '').trim();
    if (value.length < 2 || value.length > 120) {
      throw new InvalidValueException('Cidade deve ter entre 2 e 120 caracteres.');
    }
    return value;
  }

  get id(): AccountId {
    return this._id;
  }

  get name(): string {
    return this._name;
  }

  get city(): string {
    return this._city;
  }

  get reportOwner(): ReportOwner | null {
    return this._reportOwner;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }
}
