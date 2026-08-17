import { ScheduleEntry, ScheduleEntryType } from '../../domain/entities/schedule-entry.entity';
import {
  NoShowResolution,
  PaymentMethod,
  Reservation,
  ReservationStatus,
} from '../../domain/entities/reservation.entity';
import { NamedRef } from '../../../pre-order/application/dto/pre-order.dto';

/** O compromisso como a grade da agenda o consome. Sem dinheiro — a reserva é que tem valor. */
export class ScheduleEntryDto {
  id!: string;
  type!: ScheduleEntryType;
  machine!: NamedRef | null;
  customer!: NamedRef | null;
  title!: string | null;
  startsAt!: string;
  endsAt!: string;
  reservationId!: string | null;
  reservationStatus!: ReservationStatus | null;

  static fromDomain(
    entry: ScheduleEntry,
    refs: {
      machine: NamedRef | null;
      customer: NamedRef | null;
      reservation: { id: string; status: ReservationStatus } | null;
    },
  ): ScheduleEntryDto {
    const dto = new ScheduleEntryDto();
    dto.id = entry.id.value;
    dto.type = entry.type;
    dto.machine = refs.machine;
    dto.customer = refs.customer;
    dto.title = entry.title;
    dto.startsAt = entry.startsAt.toISOString();
    dto.endsAt = entry.endsAt.toISOString();
    dto.reservationId = refs.reservation?.id ?? null;
    dto.reservationStatus = refs.reservation?.status ?? null;
    return dto;
  }
}

/** Resposta de criação de compromisso: o objeto e os avisos de sobreposição (§4.8, regra 6.10). */
export class ScheduleEntryWithWarningsDto {
  entry!: ScheduleEntryDto;
  /** Vazio quando não houve sobreposição. Nunca `null` — a UI itera sem checar. */
  warnings!: string[];

  static create(entry: ScheduleEntryDto, warnings: string[]): ScheduleEntryWithWarningsDto {
    const dto = new ScheduleEntryWithWarningsDto();
    dto.entry = entry;
    dto.warnings = warnings;
    return dto;
  }
}

/** Reserva COM dinheiro — servida apenas a `admin` e `owner`. */
export class ReservationDto {
  id!: string;
  scheduleEntryId!: string;
  preOrderId!: string;
  customer!: NamedRef;
  machine!: NamedRef;
  startsAt!: string;
  endsAt!: string;
  hours!: number;
  hourPriceCents!: number;
  totalCents!: number;
  status!: ReservationStatus;
  paidAt!: string | null;
  paymentMethod!: PaymentMethod | null;
  paidRegisteredBy!: NamedRef | null;
  noShowAt!: string | null;
  noShowResolution!: NoShowResolution | null;

  static fromDomain(
    reservation: Reservation,
    refs: {
      customer: NamedRef;
      machine: NamedRef;
      paidRegisteredBy: NamedRef | null;
      startsAt: Date;
      endsAt: Date;
    },
  ): ReservationDto {
    const dto = new ReservationDto();
    dto.id = reservation.id.value;
    dto.scheduleEntryId = reservation.scheduleEntryId.value;
    dto.preOrderId = reservation.preOrderId.value;
    dto.customer = refs.customer;
    dto.machine = refs.machine;
    dto.startsAt = refs.startsAt.toISOString();
    dto.endsAt = refs.endsAt.toISOString();
    dto.hours = reservation.hours;
    dto.hourPriceCents = reservation.hourPrice.cents;
    dto.totalCents = reservation.total.cents;
    dto.status = reservation.status;
    dto.paidAt = reservation.payment?.paidAt.toISOString() ?? null;
    dto.paymentMethod = reservation.payment?.method ?? null;
    dto.paidRegisteredBy = refs.paidRegisteredBy;
    dto.noShowAt = reservation.noShowAt?.toISOString() ?? null;
    dto.noShowResolution = reservation.noShowResolution;
    return dto;
  }
}

/**
 * Reserva para o papel `modelista` — **sem nenhum campo monetário** (spec §5).
 *
 * Não é ocultar no frontend: `hourPriceCents`, `totalCents`, `paidAt`, `paymentMethod` e
 * `paidRegisteredBy` simplesmente **não são mapeados aqui**. Se o Modelista abrir o DevTools, não
 * há valor nenhum para ele achar.
 *
 * O que sobra é o que ele precisa para trabalhar: de quem é o corte, em qual máquina, quando
 * começa, quanto tempo dura.
 */
export class ReservationForModelistaDto {
  id!: string;
  customer!: NamedRef;
  machine!: NamedRef;
  startsAt!: string;
  endsAt!: string;
  hours!: number;
  status!: ReservationStatus;
  preOrderId!: string;

  static fromDomain(
    reservation: Reservation,
    refs: { customer: NamedRef; machine: NamedRef; startsAt: Date; endsAt: Date },
  ): ReservationForModelistaDto {
    const dto = new ReservationForModelistaDto();
    dto.id = reservation.id.value;
    dto.customer = refs.customer;
    dto.machine = refs.machine;
    dto.startsAt = refs.startsAt.toISOString();
    dto.endsAt = refs.endsAt.toISOString();
    // `hours` é tempo, não dinheiro: é com ele que o Modelista decide se cabe mais uma matriz.
    dto.hours = reservation.hours;
    dto.status = reservation.status;
    dto.preOrderId = reservation.preOrderId.value;
    return dto;
  }
}
