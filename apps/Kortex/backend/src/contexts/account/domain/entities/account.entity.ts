import { AggregateRoot } from '@gitspread/domain-primitives';
import { InvalidValueException } from '../../../../shared/domain/exceptions/invalid-value.exception';
import { AccountId } from '../value-objects/account-id.vo';
import { ReportOwner } from '../value-objects/report-owner.vo';

/** O fuso de quem já opera. Continua sendo o default, agora como dado e não como variável. */
export const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

/**
 * A conta é o dono da operação — o tenant. Não guarda preço da hora (é de cada máquina, §4.2) nem
 * horário de funcionamento (são as janelas de `business_hour`, §4.1.1).
 *
 * `city` é obrigatória porque é coluna do relatório mensal do governo; uma conta sem cidade só
 * descobre o problema no fechamento do mês, quando não dá mais para perguntar.
 *
 * `timezone` é o relógio da oficina. As janelas de funcionamento são horários locais e
 * `schedule_entry.starts_at` é `timestamptz`: sem o fuso da CONTA não há como dizer se um instante
 * cai dentro de uma janela. Ele mora aqui — e não numa variável de ambiente — porque é atributo da
 * operação, não da instalação: duas contas no mesmo container podem abrir em fusos diferentes.
 */
export class Account extends AggregateRoot {
  private constructor(
    private readonly _id: AccountId,
    private _name: string,
    private _city: string,
    private _timezone: string,
    private _reportOwner: ReportOwner | null,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
  ) {
    super();
  }

  static create(input: {
    name: string;
    city: string;
    timezone?: string;
    reportOwner?: ReportOwner | null;
  }): Account {
    const now = new Date();
    return new Account(
      AccountId.create(),
      Account.assertName(input.name),
      Account.assertCity(input.city),
      Account.assertTimezone(input.timezone ?? DEFAULT_TIMEZONE),
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
    timezone: string;
    reportOwner: ReportOwner | null;
    createdAt: Date;
    updatedAt: Date;
  }): Account {
    return new Account(
      input.id,
      input.name,
      input.city,
      input.timezone,
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

  /**
   * Trocar o fuso reinterpreta a agenda inteira: as janelas passam a significar outro instante, e
   * uma reserva das 07:00 vira 06:00 ou 08:00 sem nenhuma linha mudar no banco. É operação de
   * mudança de operação — não de ajuste de tela.
   */
  changeTimezone(timezone: string): void {
    this._timezone = Account.assertTimezone(timezone);
    this.touch();
  }

  changeReportOwner(reportOwner: ReportOwner | null): void {
    this._reportOwner = reportOwner;
    this.touch();
  }

  private touch(): void {
    this._updatedAt = new Date();
  }

  /**
   * Aceita só fuso IANA que este runtime conhece.
   *
   * A validação é o próprio `Intl`, e não uma lista mantida à mão: lista de fusos envelhece a cada
   * mudança de legislação, e um nome fora dela seria recusado sem motivo real. Quem sabe se o fuso
   * existe é quem vai usá-lo para converter.
   */
  private static assertTimezone(timezone: string): string {
    const value = (timezone ?? '').trim();
    if (!value) {
      throw new InvalidValueException('Fuso horário da conta é obrigatório.');
    }
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: value });
    } catch {
      throw new InvalidValueException(
        `Fuso horário desconhecido: ${value}. Use um nome IANA (ex.: America/Sao_Paulo).`,
      );
    }
    return value;
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

  get timezone(): string {
    return this._timezone;
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
