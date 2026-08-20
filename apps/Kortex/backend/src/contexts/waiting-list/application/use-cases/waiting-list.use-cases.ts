import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  SLOT_NOTICE_REPOSITORY,
  SlotNoticeRepositoryPort,
  WAITING_LIST_REPOSITORY,
  WaitingListRepositoryPort,
} from '../ports/output/waiting-list-repository.port';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../infrastructure/persistence/ports/unit-of-work.port';
import { SlotNoticeDto, WaitingListEntryDto } from '../dto/waiting-list.dto';
import {
  ReferenceResolver,
  refOrPlaceholder,
} from '../../../pre-order/application/reference-resolver';
import { NamedRef } from '../../../pre-order/application/dto/pre-order.dto';
import { WaitingListEntry } from '../../domain/entities/waiting-list-entry.entity';
import { SlotNotice } from '../../domain/entities/slot-notice.entity';
import {
  SlotNoticeNotFoundException,
  WaitingListEntryNotFoundException,
} from '../../domain/exceptions/waiting-list.exceptions';
import { WaitingListEntryId } from '../../domain/value-objects/waiting-list-entry-id.vo';
import { SlotNoticeId } from '../../domain/value-objects/slot-notice-id.vo';
import { AccountId } from '../../../account/domain/value-objects/account-id.vo';
import { CustomerId } from '../../../customer/domain/value-objects/customer-id.vo';
import { FabricId } from '../../../catalog/domain/value-objects/fabric-id.vo';
import { ProductTypeId } from '../../../catalog/domain/value-objects/product-type-id.vo';
import { PreOrderId } from '../../../pre-order/domain/value-objects/pre-order-id.vo';
import { UserId } from '../../../user/domain/value-objects/user-id.vo';
import { InvalidValueException } from '../../../../shared/domain/exceptions/invalid-value.exception';

export interface WaitingListInput {
  customerId: string;
  preOrderId?: string | null;
  fabricId?: string | null;
  productTypeId?: string | null;
  hoursNeeded: number;
  technicalNotes?: string | null;
  wantsEarlier?: boolean;
  desiredUntil?: string | null;
}

/**
 * A fila de espera é criada e gerida **exclusivamente pelo Administrativo** (spec §4.12). Todas as
 * escritas daqui saem por rotas com `AdminGuard`; a única leitura aberta ao Modelista é `list`.
 */
@Injectable()
export class WaitingListUseCases {
  constructor(
    @Inject(WAITING_LIST_REPOSITORY)
    private readonly waitingListRepository: WaitingListRepositoryPort,
    private readonly references: ReferenceResolver,
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async list(accountId: string): Promise<WaitingListEntryDto[]> {
    const account = AccountId.from(accountId);
    const entries = await this.waitingListRepository.listByAccount(account);
    return this.toDtos(account, entries);
  }

  /** Fila por resolver — `waiting` + `offered`. Alimenta o balão do menu. */
  async countPending(accountId: string): Promise<number> {
    return this.waitingListRepository.countPending(AccountId.from(accountId));
  }

  async create(accountId: string, input: WaitingListInput): Promise<WaitingListEntryDto> {
    const account = AccountId.from(accountId);

    const entry = WaitingListEntry.create({
      accountId: account,
      ...toData(input),
    });

    const saved = await this.unitOfWork.execute(async () => this.waitingListRepository.save(entry));
    return (await this.toDtos(account, [saved]))[0];
  }

  async update(
    accountId: string,
    entryId: string,
    input: WaitingListInput,
  ): Promise<WaitingListEntryDto> {
    const account = AccountId.from(accountId);
    const entry = await this.load(account, entryId);

    entry.update(toData(input));

    const saved = await this.unitOfWork.execute(async () => this.waitingListRepository.save(entry));
    return (await this.toDtos(account, [saved]))[0];
  }

  /** "Liguei e ofereci a vaga." Ainda não é reserva — pagamento é catraca (regra 6.3). */
  async offer(accountId: string, entryId: string): Promise<WaitingListEntryDto> {
    return this.mutate(accountId, entryId, (entry) => entry.offer());
  }

  /**
   * "Cliente aceitou e está vindo." Registra o aceite e para aí: a reserva nasce no ato do
   * pagamento, criada pelo Administrativo (Fase 4).
   */
  async registerAcceptance(accountId: string, entryId: string): Promise<WaitingListEntryDto> {
    return this.mutate(accountId, entryId, (entry) => entry.registerCustomerAcceptance());
  }

  async drop(accountId: string, entryId: string): Promise<WaitingListEntryDto> {
    return this.mutate(accountId, entryId, (entry) => entry.drop());
  }

  private async mutate(
    accountId: string,
    entryId: string,
    change: (entry: WaitingListEntry) => void,
  ): Promise<WaitingListEntryDto> {
    const account = AccountId.from(accountId);
    const entry = await this.load(account, entryId);

    change(entry);

    const saved = await this.unitOfWork.execute(async () => this.waitingListRepository.save(entry));
    return (await this.toDtos(account, [saved]))[0];
  }

  private async load(accountId: AccountId, entryId: string): Promise<WaitingListEntry> {
    const entry = await this.waitingListRepository.findById(
      accountId,
      WaitingListEntryId.from(entryId),
    );
    if (!entry) {
      throw new WaitingListEntryNotFoundException();
    }
    return entry;
  }

  private async toDtos(
    accountId: AccountId,
    entries: WaitingListEntry[],
  ): Promise<WaitingListEntryDto[]> {
    if (entries.length === 0) {
      return [];
    }

    const refs = await this.references.load(accountId);

    // Tecido e tipo de produto são opcionais na fila (§4.12): a entrada pode nascer de um
    // telefonema, sem pré-pedido avaliado por trás.
    const optional = (map: Map<string, NamedRef>, id: string | undefined): NamedRef | null =>
      id ? refOrPlaceholder(map, id) : null;

    return entries.map((entry) =>
      WaitingListEntryDto.fromDomain(entry, {
        customer: refOrPlaceholder(refs.customers, entry.customerId.value),
        // O `FabricRef` traz a altura máxima; a fila só precisa do nome.
        fabric: optional(refs.fabrics, entry.fabricId?.value),
        productType: optional(refs.productTypes, entry.productTypeId?.value),
      }),
    );
  }
}

/** O aviso de vaga: criado pelo Modelista, resolvido pelo Administrativo (regra 6.3). */
@Injectable()
export class SlotNoticeUseCases {
  private readonly logger = new Logger(SlotNoticeUseCases.name);

  constructor(
    @Inject(SLOT_NOTICE_REPOSITORY)
    private readonly slotNoticeRepository: SlotNoticeRepositoryPort,
    private readonly references: ReferenceResolver,
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async list(accountId: string): Promise<SlotNoticeDto[]> {
    const account = AccountId.from(accountId);
    const notices = await this.slotNoticeRepository.listByAccount(account);
    return this.toDtos(account, notices);
  }

  /** Avisos de vaga ainda não tratados — alimenta o sino do cabeçalho. */
  async countOpen(accountId: string): Promise<number> {
    return this.slotNoticeRepository.countOpen(AccountId.from(accountId));
  }

  async create(accountId: string, createdByUserId: string, note: string): Promise<SlotNoticeDto> {
    const account = AccountId.from(accountId);

    const notice = SlotNotice.create({
      accountId: account,
      createdByUserId: UserId.from(createdByUserId),
      note,
    });

    const saved = await this.unitOfWork.execute(async () => this.slotNoticeRepository.save(notice));

    this.logger.log('Aviso de horário vago registrado', { by: createdByUserId });
    return (await this.toDtos(account, [saved]))[0];
  }

  async markHandled(
    accountId: string,
    noticeId: string,
    handledByUserId: string,
  ): Promise<SlotNoticeDto> {
    const account = AccountId.from(accountId);

    const notice = await this.slotNoticeRepository.findById(account, SlotNoticeId.from(noticeId));
    if (!notice) {
      throw new SlotNoticeNotFoundException();
    }

    notice.markHandled(UserId.from(handledByUserId));

    const saved = await this.unitOfWork.execute(async () => this.slotNoticeRepository.save(notice));
    return (await this.toDtos(account, [saved]))[0];
  }

  private async toDtos(accountId: AccountId, notices: SlotNotice[]): Promise<SlotNoticeDto[]> {
    if (notices.length === 0) {
      return [];
    }

    const refs = await this.references.load(accountId);

    return notices.map((notice) =>
      SlotNoticeDto.fromDomain(notice, {
        createdBy: refOrPlaceholder(refs.users, notice.createdByUserId.value),
        handledBy: notice.handledByUserId
          ? refOrPlaceholder(refs.users, notice.handledByUserId.value)
          : null,
      }),
    );
  }
}

function toData(input: WaitingListInput) {
  return {
    customerId: CustomerId.from(input.customerId),
    preOrderId: input.preOrderId ? PreOrderId.from(input.preOrderId) : null,
    fabricId: input.fabricId ? FabricId.from(input.fabricId) : null,
    productTypeId: input.productTypeId ? ProductTypeId.from(input.productTypeId) : null,
    hoursNeeded: input.hoursNeeded,
    technicalNotes: input.technicalNotes ?? null,
    wantsEarlier: input.wantsEarlier ?? false,
    desiredUntil: parseDate(input.desiredUntil),
  };
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new InvalidValueException('A data deve estar no formato AAAA-MM-DD.');
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new InvalidValueException('Data inválida.');
  }
  return date;
}
