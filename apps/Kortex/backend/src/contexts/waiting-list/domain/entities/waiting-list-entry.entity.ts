import { AggregateRoot } from '@gitspread/domain-primitives';
import { InvalidValueException } from '../../../../shared/domain/exceptions/invalid-value.exception';
import { AccountId } from '../../../account/domain/value-objects/account-id.vo';
import { CustomerId } from '../../../customer/domain/value-objects/customer-id.vo';
import { FabricId } from '../../../catalog/domain/value-objects/fabric-id.vo';
import { ProductTypeId } from '../../../catalog/domain/value-objects/product-type-id.vo';
import { PreOrderId } from '../../../pre-order/domain/value-objects/pre-order-id.vo';
import { WaitingListEntryId } from '../value-objects/waiting-list-entry-id.vo';
import { InvalidWaitingListTransitionException } from '../exceptions/waiting-list.exceptions';

export const WAITING_LIST_STATUSES = ['waiting', 'offered', 'converted', 'dropped'] as const;
export type WaitingListStatus = (typeof WAITING_LIST_STATUSES)[number];

export const WAITING_LIST_STATUS_LABELS: Record<WaitingListStatus, string> = {
  waiting: 'Esperando',
  offered: 'Vaga oferecida',
  converted: 'Virou reserva',
  dropped: 'Desistiu',
};

const MAX_HOURS = 24;

/**
 * Uma entrada na fila de espera (spec §4.12).
 *
 * **Criada e gerida exclusivamente pelo Administrativo.** O Modelista tem acesso somente de
 * leitura: consulta a lista e aciona o Administrativo quando enxerga vaga, nada além disso
 * (regra 6.3). O conhecimento técnico não se perde por isso — tecido, horas e particularidade já
 * vêm do `pre_order` que ele avaliou.
 *
 * `wantsEarlier` é o campo que a tela destaca: o encaixe vem **sempre** da fila (2.15) e nunca
 * antecipando quem já está agendado (6.8), então quem quer antecipar é exatamente quem se chama
 * quando um horário vaga.
 */
export class WaitingListEntry extends AggregateRoot {
  private constructor(
    private readonly _id: WaitingListEntryId,
    private readonly _accountId: AccountId,
    private _customerId: CustomerId,
    private _preOrderId: PreOrderId | null,
    private _fabricId: FabricId | null,
    private _productTypeId: ProductTypeId | null,
    private _hoursNeeded: number,
    private _technicalNotes: string | null,
    private _wantsEarlier: boolean,
    private _desiredUntil: Date | null,
    private _status: WaitingListStatus,
    private _offeredAt: Date | null,
    private _customerAcceptedAt: Date | null,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
  ) {
    super();
  }

  static create(input: WaitingListEntryData & { accountId: AccountId }): WaitingListEntry {
    const now = new Date();
    return new WaitingListEntry(
      WaitingListEntryId.create(),
      input.accountId,
      input.customerId,
      input.preOrderId,
      input.fabricId,
      input.productTypeId,
      WaitingListEntry.assertHours(input.hoursNeeded),
      input.technicalNotes?.trim() || null,
      input.wantsEarlier,
      input.desiredUntil,
      'waiting',
      null,
      null,
      now,
      now,
    );
  }

  static restore(input: {
    id: WaitingListEntryId;
    accountId: AccountId;
    customerId: CustomerId;
    preOrderId: PreOrderId | null;
    fabricId: FabricId | null;
    productTypeId: ProductTypeId | null;
    hoursNeeded: number;
    technicalNotes: string | null;
    wantsEarlier: boolean;
    desiredUntil: Date | null;
    status: WaitingListStatus;
    offeredAt: Date | null;
    customerAcceptedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): WaitingListEntry {
    return new WaitingListEntry(
      input.id,
      input.accountId,
      input.customerId,
      input.preOrderId,
      input.fabricId,
      input.productTypeId,
      input.hoursNeeded,
      input.technicalNotes,
      input.wantsEarlier,
      input.desiredUntil,
      input.status,
      input.offeredAt,
      input.customerAcceptedAt,
      input.createdAt,
      input.updatedAt,
    );
  }

  update(input: WaitingListEntryData): void {
    this.assertOpen('editar');
    this._customerId = input.customerId;
    this._preOrderId = input.preOrderId;
    this._fabricId = input.fabricId;
    this._productTypeId = input.productTypeId;
    this._hoursNeeded = WaitingListEntry.assertHours(input.hoursNeeded);
    this._technicalNotes = input.technicalNotes?.trim() || null;
    this._wantsEarlier = input.wantsEarlier;
    this._desiredUntil = input.desiredUntil;
    this.touch();
  }

  /** O Administrativo ligou e ofereceu a vaga. Ainda não é reserva — pagamento é catraca (6.3). */
  offer(at: Date = new Date()): void {
    if (this._status !== 'waiting') {
      throw new InvalidWaitingListTransitionException('oferecer a vaga', this._status);
    }
    this._status = 'offered';
    this._offeredAt = at;
    this.touch();
  }

  /**
   * "Cliente aceitou e está vindo". Registra o aceite e **para aí**: a reserva só existe depois
   * do pagamento registrado, e é o Administrativo quem a cria (regra 6.3, Fase 4).
   */
  registerCustomerAcceptance(at: Date = new Date()): void {
    if (this._status !== 'offered') {
      throw new InvalidWaitingListTransitionException('registrar o aceite', this._status);
    }
    this._customerAcceptedAt = at;
    this.touch();
  }

  /** Fase 4: a reserva foi criada e paga. Terminal. */
  markConverted(): void {
    if (this._status !== 'offered') {
      throw new InvalidWaitingListTransitionException('converter em reserva', this._status);
    }
    this._status = 'converted';
    this.touch();
  }

  drop(): void {
    if (this._status === 'converted') {
      throw new InvalidWaitingListTransitionException('remover da fila', this._status);
    }
    this._status = 'dropped';
    this.touch();
  }

  private assertOpen(action: string): void {
    if (this._status === 'converted' || this._status === 'dropped') {
      throw new InvalidWaitingListTransitionException(action, this._status);
    }
  }

  private touch(): void {
    this._updatedAt = new Date();
  }

  private static assertHours(hours: number): number {
    if (!Number.isInteger(hours) || hours < 1) {
      throw new InvalidValueException('As horas necessárias devem ser um inteiro de 1 ou mais.');
    }
    if (hours > MAX_HOURS) {
      throw new InvalidValueException(`As horas necessárias não podem passar de ${MAX_HOURS}.`);
    }
    return hours;
  }

  get id(): WaitingListEntryId {
    return this._id;
  }

  get accountId(): AccountId {
    return this._accountId;
  }

  get customerId(): CustomerId {
    return this._customerId;
  }

  get preOrderId(): PreOrderId | null {
    return this._preOrderId;
  }

  get fabricId(): FabricId | null {
    return this._fabricId;
  }

  get productTypeId(): ProductTypeId | null {
    return this._productTypeId;
  }

  get hoursNeeded(): number {
    return this._hoursNeeded;
  }

  get technicalNotes(): string | null {
    return this._technicalNotes;
  }

  get wantsEarlier(): boolean {
    return this._wantsEarlier;
  }

  get desiredUntil(): Date | null {
    return this._desiredUntil;
  }

  get status(): WaitingListStatus {
    return this._status;
  }

  get offeredAt(): Date | null {
    return this._offeredAt;
  }

  get customerAcceptedAt(): Date | null {
    return this._customerAcceptedAt;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }
}

export interface WaitingListEntryData {
  customerId: CustomerId;
  preOrderId: PreOrderId | null;
  fabricId: FabricId | null;
  productTypeId: ProductTypeId | null;
  hoursNeeded: number;
  technicalNotes?: string | null;
  wantsEarlier: boolean;
  desiredUntil: Date | null;
}
