import { AggregateRoot } from '@gitspread/domain-primitives';
import { InvalidValueException } from '../../../../shared/domain/exceptions/invalid-value.exception';
import { TimeOfDay } from '../../../../shared/domain/value-objects/time-of-day.vo';
import { AccountId } from '../value-objects/account-id.vo';
import { BusinessHourId } from '../value-objects/business-hour-id.vo';
import { OverlappingBusinessHourException } from '../exceptions/overlapping-business-hour.exception';

/**
 * Uma janela de funcionamento (spec §4.1.1). O modelo é de **janelas abertas**, não de intervalos
 * fechados: um dia com almoço das 12h às 13h tem duas linhas, 07:00–12:00 e 13:00–19:00, e o
 * intervalo é a ausência de janela entre elas.
 *
 * A diferença importa. Com intervalos explícitos existiriam dois estados a manter em acordo
 * ("aberto" e "em intervalo") e a pergunta "e se um intervalo cair fora do expediente?" precisaria
 * de resposta. Com janelas, a pergunta não existe, e a quantidade de intervalos por dia é livre.
 */
export class BusinessHour extends AggregateRoot {
  private constructor(
    private readonly _id: BusinessHourId,
    private readonly _accountId: AccountId,
    private readonly _weekday: number,
    private readonly _startsAt: TimeOfDay,
    private readonly _endsAt: TimeOfDay,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
  ) {
    super();
  }

  static create(input: {
    accountId: AccountId;
    weekday: number;
    startsAt: TimeOfDay;
    endsAt: TimeOfDay;
  }): BusinessHour {
    BusinessHour.assertWeekday(input.weekday);
    BusinessHour.assertOrdered(input.startsAt, input.endsAt);

    const now = new Date();
    return new BusinessHour(
      BusinessHourId.create(),
      input.accountId,
      input.weekday,
      input.startsAt,
      input.endsAt,
      now,
      now,
    );
  }

  static restore(input: {
    id: BusinessHourId;
    accountId: AccountId;
    weekday: number;
    startsAt: TimeOfDay;
    endsAt: TimeOfDay;
    createdAt: Date;
    updatedAt: Date;
  }): BusinessHour {
    return new BusinessHour(
      input.id,
      input.accountId,
      input.weekday,
      input.startsAt,
      input.endsAt,
      input.createdAt,
      input.updatedAt,
    );
  }

  /**
   * Recusa a janela candidata se ela cruzar qualquer uma das existentes do mesmo dia.
   *
   * Encostar não é cruzar: 07:00–11:30 e 11:30–13:00 convivem, porque a janela é fechada no início
   * e aberta no fim — o mesmo `'[)'` da constraint de exclusão no banco. Sem isso, uma operação que
   * abre às 11:30 em ponto teria de cadastrar 11:31 para o sistema aceitar.
   */
  static assertNoOverlap(existing: BusinessHour[], candidate: BusinessHour): void {
    for (const other of existing) {
      if (other.id.equals(candidate.id)) {
        continue;
      }
      if (other.weekday !== candidate.weekday) {
        continue;
      }
      const overlaps =
        candidate.startsAt.minutes < other.endsAt.minutes &&
        other.startsAt.minutes < candidate.endsAt.minutes;

      if (overlaps) {
        throw new OverlappingBusinessHourException(other.label, candidate.label);
      }
    }
  }

  private static assertWeekday(weekday: number): void {
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
      throw new InvalidValueException('Dia da semana deve ser um número de 0 (domingo) a 6.');
    }
  }

  private static assertOrdered(startsAt: TimeOfDay, endsAt: TimeOfDay): void {
    if (!startsAt.isBefore(endsAt)) {
      throw new InvalidValueException('O fim da janela deve ser depois do início.');
    }
  }

  /** Duração em minutos — soma das janelas do dia é o "dia inteiro" da regra 2.11. */
  get durationMinutes(): number {
    return this._endsAt.minutes - this._startsAt.minutes;
  }

  /** '07:00–11:30', para mensagem de erro e para a tela. */
  get label(): string {
    return `${this._startsAt.value}–${this._endsAt.value}`;
  }

  get id(): BusinessHourId {
    return this._id;
  }

  get accountId(): AccountId {
    return this._accountId;
  }

  get weekday(): number {
    return this._weekday;
  }

  get startsAt(): TimeOfDay {
    return this._startsAt;
  }

  get endsAt(): TimeOfDay {
    return this._endsAt;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }
}
