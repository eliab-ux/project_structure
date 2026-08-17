import {
  WaitingListEntry,
  WaitingListStatus,
} from '../../domain/entities/waiting-list-entry.entity';
import { SlotNotice, SlotNoticeStatus } from '../../domain/entities/slot-notice.entity';
import { NamedRef } from '../../../pre-order/application/dto/pre-order.dto';

/**
 * Entrada da fila. Servida aos três papéis — o Modelista lê (§5) e não há valor em dinheiro
 * nenhum aqui: a fila é sobre horas e tecido, não sobre preço.
 */
export class WaitingListEntryDto {
  id!: string;
  customer!: NamedRef;
  preOrderId!: string | null;
  fabric!: NamedRef | null;
  productType!: NamedRef | null;
  hoursNeeded!: number;
  technicalNotes!: string | null;
  /** O campo que a tela destaca (DoD da Fase 3). */
  wantsEarlier!: boolean;
  desiredUntil!: string | null;
  status!: WaitingListStatus;
  offeredAt!: string | null;
  customerAcceptedAt!: string | null;
  createdAt!: string;

  static fromDomain(
    entry: WaitingListEntry,
    refs: { customer: NamedRef; fabric: NamedRef | null; productType: NamedRef | null },
  ): WaitingListEntryDto {
    const dto = new WaitingListEntryDto();
    dto.id = entry.id.value;
    dto.customer = refs.customer;
    dto.preOrderId = entry.preOrderId?.value ?? null;
    dto.fabric = refs.fabric;
    dto.productType = refs.productType;
    dto.hoursNeeded = entry.hoursNeeded;
    dto.technicalNotes = entry.technicalNotes;
    dto.wantsEarlier = entry.wantsEarlier;
    dto.desiredUntil = entry.desiredUntil ? entry.desiredUntil.toISOString().slice(0, 10) : null;
    dto.status = entry.status;
    dto.offeredAt = entry.offeredAt?.toISOString() ?? null;
    dto.customerAcceptedAt = entry.customerAcceptedAt?.toISOString() ?? null;
    dto.createdAt = entry.createdAt.toISOString();
    return dto;
  }
}

export class SlotNoticeDto {
  id!: string;
  note!: string;
  status!: SlotNoticeStatus;
  createdBy!: NamedRef;
  createdAt!: string;
  handledBy!: NamedRef | null;
  handledAt!: string | null;

  static fromDomain(
    notice: SlotNotice,
    refs: { createdBy: NamedRef; handledBy: NamedRef | null },
  ): SlotNoticeDto {
    const dto = new SlotNoticeDto();
    dto.id = notice.id.value;
    dto.note = notice.note;
    dto.status = notice.status;
    dto.createdBy = refs.createdBy;
    dto.createdAt = notice.createdAt.toISOString();
    dto.handledBy = refs.handledBy;
    dto.handledAt = notice.handledAt?.toISOString() ?? null;
    return dto;
  }
}
