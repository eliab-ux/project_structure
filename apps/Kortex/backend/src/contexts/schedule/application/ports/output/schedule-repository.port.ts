import { ScheduleEntry } from '../../../domain/entities/schedule-entry.entity';
import { Reservation } from '../../../domain/entities/reservation.entity';
import { ScheduleEntryId } from '../../../domain/value-objects/schedule-entry-id.vo';
import { ReservationId } from '../../../domain/value-objects/reservation-id.vo';
import { AccountId } from '../../../../account/domain/value-objects/account-id.vo';

export const SCHEDULE_ENTRY_REPOSITORY = Symbol('SCHEDULE_ENTRY_REPOSITORY');
export const RESERVATION_REPOSITORY = Symbol('RESERVATION_REPOSITORY');

export interface ScheduleEntryRepositoryPort {
  /** Grade da agenda: tudo que toca a janela [from, to). */
  listInRange(accountId: AccountId, from: Date, to: Date): Promise<ScheduleEntry[]>;
  findById(accountId: AccountId, id: ScheduleEntryId): Promise<ScheduleEntry | null>;
  save(entry: ScheduleEntry): Promise<ScheduleEntry>;
  delete(accountId: AccountId, id: ScheduleEntryId): Promise<void>;
}

export interface ReservationRepositoryPort {
  listByAccount(accountId: AccountId): Promise<Reservation[]>;
  /**
   * A fila do Modelista: **só `confirmed` e `in_progress`** (§5).
   *
   * O filtro é do REPOSITÓRIO, não do use case nem do DTO. Uma reserva `pre_reserved` não sai da
   * persistência para ele — e assim nem um `map` esquecido consegue vazá-la.
   */
  listVisibleToModelista(accountId: AccountId): Promise<Reservation[]>;
  findById(accountId: AccountId, id: ReservationId): Promise<Reservation | null>;
  findByScheduleEntry(accountId: AccountId, id: ScheduleEntryId): Promise<Reservation | null>;
  save(reservation: Reservation): Promise<Reservation>;
}
