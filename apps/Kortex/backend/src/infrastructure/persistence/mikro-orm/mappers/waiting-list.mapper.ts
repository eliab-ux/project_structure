import { Injectable } from '@nestjs/common';
import {
  WaitingListEntry,
  WaitingListStatus,
} from '../../../../contexts/waiting-list/domain/entities/waiting-list-entry.entity';
import {
  SlotNotice,
  SlotNoticeStatus,
} from '../../../../contexts/waiting-list/domain/entities/slot-notice.entity';
import { WaitingListEntryId } from '../../../../contexts/waiting-list/domain/value-objects/waiting-list-entry-id.vo';
import { SlotNoticeId } from '../../../../contexts/waiting-list/domain/value-objects/slot-notice-id.vo';
import { AccountId } from '../../../../contexts/account/domain/value-objects/account-id.vo';
import { CustomerId } from '../../../../contexts/customer/domain/value-objects/customer-id.vo';
import { FabricId } from '../../../../contexts/catalog/domain/value-objects/fabric-id.vo';
import { ProductTypeId } from '../../../../contexts/catalog/domain/value-objects/product-type-id.vo';
import { PreOrderId } from '../../../../contexts/pre-order/domain/value-objects/pre-order-id.vo';
import { UserId } from '../../../../contexts/user/domain/value-objects/user-id.vo';
import { WaitingListEntryOrmEntity } from '../entities/waiting-list-entry-orm.entity';
import { SlotNoticeOrmEntity } from '../entities/slot-notice-orm.entity';

@Injectable()
export class WaitingListMapper {
  toDomain(orm: WaitingListEntryOrmEntity): WaitingListEntry {
    return WaitingListEntry.restore({
      id: WaitingListEntryId.from(orm.id),
      accountId: AccountId.from(orm.accountId),
      customerId: CustomerId.from(orm.customerId),
      preOrderId: orm.preOrderId ? PreOrderId.from(orm.preOrderId) : null,
      fabricId: orm.fabricId ? FabricId.from(orm.fabricId) : null,
      productTypeId: orm.productTypeId ? ProductTypeId.from(orm.productTypeId) : null,
      hoursNeeded: orm.hoursNeeded,
      technicalNotes: orm.technicalNotes,
      wantsEarlier: orm.wantsEarlier,
      // 'AAAA-MM-DD' → Date em UTC; sem o sufixo, o Node leria como horário local.
      desiredUntil: orm.desiredUntil ? new Date(`${orm.desiredUntil}T00:00:00.000Z`) : null,
      status: orm.status as WaitingListStatus,
      offeredAt: orm.offeredAt,
      customerAcceptedAt: orm.customerAcceptedAt,
      createdAt: orm.createdAt,
      updatedAt: orm.updatedAt,
    });
  }

  toOrm(
    domain: WaitingListEntry,
    target: WaitingListEntryOrmEntity = new WaitingListEntryOrmEntity(),
  ): WaitingListEntryOrmEntity {
    target.id = domain.id.value;
    target.accountId = domain.accountId.value;
    target.customerId = domain.customerId.value;
    target.preOrderId = domain.preOrderId?.value ?? null;
    target.fabricId = domain.fabricId?.value ?? null;
    target.productTypeId = domain.productTypeId?.value ?? null;
    target.hoursNeeded = domain.hoursNeeded;
    target.technicalNotes = domain.technicalNotes;
    target.wantsEarlier = domain.wantsEarlier;
    target.desiredUntil = domain.desiredUntil
      ? domain.desiredUntil.toISOString().slice(0, 10)
      : null;
    target.status = domain.status;
    target.offeredAt = domain.offeredAt;
    target.customerAcceptedAt = domain.customerAcceptedAt;
    target.createdAt = domain.createdAt;
    target.updatedAt = domain.updatedAt;
    return target;
  }
}

@Injectable()
export class SlotNoticeMapper {
  toDomain(orm: SlotNoticeOrmEntity): SlotNotice {
    return SlotNotice.restore({
      id: SlotNoticeId.from(orm.id),
      accountId: AccountId.from(orm.accountId),
      createdByUserId: UserId.from(orm.createdByUserId),
      note: orm.note,
      status: orm.status as SlotNoticeStatus,
      handledByUserId: orm.handledByUserId ? UserId.from(orm.handledByUserId) : null,
      handledAt: orm.handledAt,
      createdAt: orm.createdAt,
    });
  }

  toOrm(
    domain: SlotNotice,
    target: SlotNoticeOrmEntity = new SlotNoticeOrmEntity(),
  ): SlotNoticeOrmEntity {
    target.id = domain.id.value;
    target.accountId = domain.accountId.value;
    target.createdByUserId = domain.createdByUserId.value;
    target.note = domain.note;
    target.status = domain.status;
    target.handledByUserId = domain.handledByUserId?.value ?? null;
    target.handledAt = domain.handledAt;
    target.createdAt = domain.createdAt;
    return target;
  }
}
