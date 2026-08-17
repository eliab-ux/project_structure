import { WaitingListEntry } from '../../../domain/entities/waiting-list-entry.entity';
import { SlotNotice } from '../../../domain/entities/slot-notice.entity';
import { WaitingListEntryId } from '../../../domain/value-objects/waiting-list-entry-id.vo';
import { SlotNoticeId } from '../../../domain/value-objects/slot-notice-id.vo';
import { AccountId } from '../../../../account/domain/value-objects/account-id.vo';

export const WAITING_LIST_REPOSITORY = Symbol('WAITING_LIST_REPOSITORY');
export const SLOT_NOTICE_REPOSITORY = Symbol('SLOT_NOTICE_REPOSITORY');

export interface WaitingListRepositoryPort {
  /**
   * A fila na ordem em que a operação a lê: **quem quer antecipar primeiro**, depois por ordem de
   * chegada. Não é preferência de tela — o encaixe vem sempre da fila (2.15) e quem quer
   * antecipar é justamente quem se chama quando um horário vaga.
   */
  listByAccount(accountId: AccountId): Promise<WaitingListEntry[]>;
  findById(accountId: AccountId, id: WaitingListEntryId): Promise<WaitingListEntry | null>;
  save(entry: WaitingListEntry): Promise<WaitingListEntry>;
}

export interface SlotNoticeRepositoryPort {
  listByAccount(accountId: AccountId): Promise<SlotNotice[]>;
  findById(accountId: AccountId, id: SlotNoticeId): Promise<SlotNotice | null>;
  save(notice: SlotNotice): Promise<SlotNotice>;
}
