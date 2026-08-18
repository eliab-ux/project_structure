import { AggregateRoot } from '@gitspread/domain-primitives';
import { InvalidValueException } from '../../../../shared/domain/exceptions/invalid-value.exception';
import { AccountId } from '../../../account/domain/value-objects/account-id.vo';
import { BusinessHour } from '../../../account/domain/entities/business-hour.entity';
import { MachineId } from '../../../machine/domain/value-objects/machine-id.vo';
import { CustomerId } from '../../../customer/domain/value-objects/customer-id.vo';
import { ScheduleEntryId } from '../value-objects/schedule-entry-id.vo';
import { BusinessHoursPolicy } from '../services/business-hours-policy';
import { MachineHourOverlapException } from '../exceptions/schedule.exceptions';

export const SCHEDULE_ENTRY_TYPES = ['machine_hour', 'consultation'] as const;
export type ScheduleEntryType = (typeof SCHEDULE_ENTRY_TYPES)[number];

export const SCHEDULE_ENTRY_TYPE_LABELS: Record<ScheduleEntryType, string> = {
  machine_hour: 'Hora de máquina',
  consultation: 'Atendimento',
};

/**
 * Um compromisso na agenda (spec §4.8).
 *
 * Uma tabela para os dois tipos porque ambos ocupam a agenda do Modelista — mas com **duas regras
 * de sobreposição diferentes, que a spec pede explicitamente para não unificar**:
 *
 * - `machine_hour` × `machine_hour` na mesma máquina: **proibido**, erro.
 * - `consultation` × qualquer coisa: **permitido**, com aviso. O Administrativo decide (6.10).
 *
 * As restrições de hora cheia e janela de funcionamento valem só para `machine_hour`. Atendimento
 * pode ser de 30 minutos, fora de hora cheia, e é assim de propósito — a conversa com o cliente
 * não é o que se vende.
 */
export class ScheduleEntry extends AggregateRoot {
  private constructor(
    private readonly _id: ScheduleEntryId,
    private readonly _accountId: AccountId,
    private readonly _type: ScheduleEntryType,
    private _machineId: MachineId | null,
    private _startsAt: Date,
    private _endsAt: Date,
    private _customerId: CustomerId | null,
    private _title: string | null,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
  ) {
    super();
  }

  /**
   * Hora de máquina: valida hora cheia e janela ANTES de existir.
   *
   * Recebe as janelas do dia porque a regra depende delas e o domínio não vai ao banco. Quem
   * carrega é o use case.
   */
  static createMachineHour(input: {
    accountId: AccountId;
    machineId: MachineId;
    startsAt: Date;
    endsAt: Date;
    customerId: CustomerId;
    businessHours: BusinessHour[];
    /** Fuso da CONTA. Ausente cai no default da policy — o caminho dos testes de domínio. */
    timeZone?: string;
  }): { entry: ScheduleEntry; hours: number } {
    const hours = BusinessHoursPolicy.assertWholeHours(
      input.startsAt,
      input.endsAt,
      input.timeZone,
    );
    BusinessHoursPolicy.assertWithinSingleWindow(
      input.startsAt,
      input.endsAt,
      input.businessHours,
      input.timeZone,
    );

    const now = new Date();
    const entry = new ScheduleEntry(
      ScheduleEntryId.create(),
      input.accountId,
      'machine_hour',
      input.machineId,
      input.startsAt,
      input.endsAt,
      input.customerId,
      null,
      now,
      now,
    );

    return { entry, hours };
  }

  /** Atendimento: sem hora cheia, sem janela, sem máquina. Cliente é opcional (pode ser prospect). */
  static createConsultation(input: {
    accountId: AccountId;
    startsAt: Date;
    endsAt: Date;
    title: string;
    customerId: CustomerId | null;
  }): ScheduleEntry {
    if (input.endsAt.getTime() <= input.startsAt.getTime()) {
      throw new InvalidValueException('O fim do atendimento deve ser depois do início.');
    }

    const title = (input.title ?? '').trim();
    if (title.length < 2 || title.length > 200) {
      throw new InvalidValueException('O atendimento precisa de um título.');
    }

    const now = new Date();
    return new ScheduleEntry(
      ScheduleEntryId.create(),
      input.accountId,
      'consultation',
      null,
      input.startsAt,
      input.endsAt,
      input.customerId,
      title,
      now,
      now,
    );
  }

  static restore(input: {
    id: ScheduleEntryId;
    accountId: AccountId;
    type: ScheduleEntryType;
    machineId: MachineId | null;
    startsAt: Date;
    endsAt: Date;
    customerId: CustomerId | null;
    title: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): ScheduleEntry {
    return new ScheduleEntry(
      input.id,
      input.accountId,
      input.type,
      input.machineId,
      input.startsAt,
      input.endsAt,
      input.customerId,
      input.title,
      input.createdAt,
      input.updatedAt,
    );
  }

  /**
   * Recusa se colidir com outra hora de máquina da mesma máquina.
   *
   * Encostar não é colidir: uma reserva que termina às 11h e outra que começa às 11h convivem —
   * é como a agenda de uma oficina funciona, uma emendando na outra. É o mesmo `'[)'` da
   * constraint de exclusão no banco.
   */
  assertNoMachineOverlap(existing: ScheduleEntry[]): void {
    if (this._type !== 'machine_hour') {
      return;
    }

    for (const other of existing) {
      if (other.id.value === this._id.value) {
        continue;
      }
      if (other.type !== 'machine_hour') {
        continue;
      }
      if (other.machineId?.value !== this._machineId?.value) {
        continue;
      }
      const overlaps =
        this._startsAt.getTime() < other.endsAt.getTime() &&
        other.startsAt.getTime() < this._endsAt.getTime();

      if (overlaps) {
        throw new MachineHourOverlapException();
      }
    }
  }

  /**
   * Avisos, não erros: um atendimento pode sobrepor qualquer coisa (regra 6.10). A API devolve a
   * lista no response e a UI mostra o alerta — o Administrativo decide.
   */
  collectOverlapWarnings(existing: ScheduleEntry[]): string[] {
    if (this._type !== 'consultation') {
      return [];
    }

    return existing
      .filter(
        (other) =>
          other.id.value !== this._id.value &&
          this._startsAt.getTime() < other.endsAt.getTime() &&
          other.startsAt.getTime() < this._endsAt.getTime(),
      )
      .map(
        (other) =>
          `Este atendimento sobrepõe ${SCHEDULE_ENTRY_TYPE_LABELS[other.type].toLowerCase()} já na agenda.`,
      );
  }

  /** Mover a hora de máquina revalida tudo: hora cheia, janela e sobreposição. */
  moveMachineHour(input: {
    startsAt: Date;
    endsAt: Date;
    businessHours: BusinessHour[];
    timeZone?: string;
  }): number {
    const hours = BusinessHoursPolicy.assertWholeHours(
      input.startsAt,
      input.endsAt,
      input.timeZone,
    );
    BusinessHoursPolicy.assertWithinSingleWindow(
      input.startsAt,
      input.endsAt,
      input.businessHours,
      input.timeZone,
    );

    this._startsAt = input.startsAt;
    this._endsAt = input.endsAt;
    this._updatedAt = new Date();
    return hours;
  }

  get id(): ScheduleEntryId {
    return this._id;
  }

  get accountId(): AccountId {
    return this._accountId;
  }

  get type(): ScheduleEntryType {
    return this._type;
  }

  get machineId(): MachineId | null {
    return this._machineId;
  }

  get startsAt(): Date {
    return this._startsAt;
  }

  get endsAt(): Date {
    return this._endsAt;
  }

  get customerId(): CustomerId | null {
    return this._customerId;
  }

  get title(): string | null {
    return this._title;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }
}
