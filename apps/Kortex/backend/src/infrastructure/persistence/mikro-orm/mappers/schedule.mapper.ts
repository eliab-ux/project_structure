import { Injectable } from '@nestjs/common';
import {
  ScheduleEntry,
  ScheduleEntryType,
} from '../../../../contexts/schedule/domain/entities/schedule-entry.entity';
import {
  NoShowResolution,
  PaymentMethod,
  Reservation,
  ReservationStatus,
} from '../../../../contexts/schedule/domain/entities/reservation.entity';
import { ScheduleEntryId } from '../../../../contexts/schedule/domain/value-objects/schedule-entry-id.vo';
import { ReservationId } from '../../../../contexts/schedule/domain/value-objects/reservation-id.vo';
import { AccountId } from '../../../../contexts/account/domain/value-objects/account-id.vo';
import { MachineId } from '../../../../contexts/machine/domain/value-objects/machine-id.vo';
import { CustomerId } from '../../../../contexts/customer/domain/value-objects/customer-id.vo';
import { PreOrderId } from '../../../../contexts/pre-order/domain/value-objects/pre-order-id.vo';
import { UserId } from '../../../../contexts/user/domain/value-objects/user-id.vo';
import { Money } from '../../../../shared/domain/value-objects/money.vo';
import { ScheduleEntryOrmEntity } from '../entities/schedule-entry-orm.entity';
import { ReservationOrmEntity } from '../entities/reservation-orm.entity';

@Injectable()
export class ScheduleEntryMapper {
  toDomain(orm: ScheduleEntryOrmEntity): ScheduleEntry {
    return ScheduleEntry.restore({
      id: ScheduleEntryId.from(orm.id),
      accountId: AccountId.from(orm.accountId),
      type: orm.type as ScheduleEntryType,
      machineId: orm.machineId ? MachineId.from(orm.machineId) : null,
      startsAt: orm.startsAt,
      endsAt: orm.endsAt,
      customerId: orm.customerId ? CustomerId.from(orm.customerId) : null,
      title: orm.title,
      createdAt: orm.createdAt,
      updatedAt: orm.updatedAt,
    });
  }

  toOrm(
    domain: ScheduleEntry,
    target: ScheduleEntryOrmEntity = new ScheduleEntryOrmEntity(),
  ): ScheduleEntryOrmEntity {
    target.id = domain.id.value;
    target.accountId = domain.accountId.value;
    target.machineId = domain.machineId?.value ?? null;
    target.type = domain.type;
    target.startsAt = domain.startsAt;
    target.endsAt = domain.endsAt;
    target.customerId = domain.customerId?.value ?? null;
    target.title = domain.title;
    target.createdAt = domain.createdAt;
    target.updatedAt = domain.updatedAt;
    return target;
  }
}

@Injectable()
export class ReservationMapper {
  toDomain(orm: ReservationOrmEntity): Reservation {
    return Reservation.restore({
      id: ReservationId.from(orm.id),
      accountId: AccountId.from(orm.accountId),
      scheduleEntryId: ScheduleEntryId.from(orm.scheduleEntryId),
      preOrderId: PreOrderId.from(orm.preOrderId),
      customerId: CustomerId.from(orm.customerId),
      machineId: MachineId.from(orm.machineId),
      hours: orm.hours,
      hourPrice: Money.fromCents(orm.hourPriceCents),
      status: orm.status as ReservationStatus,
      // Os três campos do pagamento andam juntos — o CHECK no banco garante, e aqui a leitura
      // reflete isso: ou existe o bloco inteiro, ou não existe pagamento.
      payment:
        orm.paidAt && orm.paymentMethod && orm.paidRegisteredBy
          ? {
              paidAt: orm.paidAt,
              method: orm.paymentMethod as PaymentMethod,
              registeredBy: UserId.from(orm.paidRegisteredBy),
            }
          : null,
      noShowAt: orm.noShowAt,
      noShowResolution: orm.noShowResolution as NoShowResolution | null,
      createdAt: orm.createdAt,
      updatedAt: orm.updatedAt,
    });
  }

  toOrm(
    domain: Reservation,
    target: ReservationOrmEntity = new ReservationOrmEntity(),
  ): ReservationOrmEntity {
    target.id = domain.id.value;
    target.accountId = domain.accountId.value;
    target.scheduleEntryId = domain.scheduleEntryId.value;
    target.preOrderId = domain.preOrderId.value;
    target.customerId = domain.customerId.value;
    target.machineId = domain.machineId.value;
    target.hours = domain.hours;
    target.hourPriceCents = domain.hourPrice.cents;
    // Derivado no domínio e gravado: é o valor que o fechamento do mês vai somar daqui a anos.
    target.totalCents = domain.total.cents;
    target.status = domain.status;
    target.paidAt = domain.payment?.paidAt ?? null;
    target.paymentMethod = domain.payment?.method ?? null;
    target.paidRegisteredBy = domain.payment?.registeredBy.value ?? null;
    target.noShowAt = domain.noShowAt;
    target.noShowResolution = domain.noShowResolution;
    target.createdAt = domain.createdAt;
    target.updatedAt = domain.updatedAt;
    return target;
  }
}
