import { AggregateRoot } from '@gitspread/domain-primitives';
import { InvalidValueException } from '../../../../shared/domain/exceptions/invalid-value.exception';
import { Money } from '../../../../shared/domain/value-objects/money.vo';
import { AccountId } from '../../../account/domain/value-objects/account-id.vo';
import { CustomerId } from '../../../customer/domain/value-objects/customer-id.vo';
import { MachineId } from '../../../machine/domain/value-objects/machine-id.vo';
import { PreOrderId } from '../../../pre-order/domain/value-objects/pre-order-id.vo';
import { UserId } from '../../../user/domain/value-objects/user-id.vo';
import { ReservationId } from '../value-objects/reservation-id.vo';
import { ScheduleEntryId } from '../value-objects/schedule-entry-id.vo';
import { InvalidReservationTransitionException } from '../exceptions/schedule.exceptions';

export const RESERVATION_STATUSES = [
  'pre_reserved',
  'confirmed',
  'in_progress',
  'completed',
  'released',
  'no_show',
  'cancelled',
] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> = {
  pre_reserved: 'Pré-reservada',
  confirmed: 'Paga',
  in_progress: 'Em execução',
  completed: 'Concluída',
  released: 'Liberada',
  no_show: 'Não compareceu',
  cancelled: 'Cancelada',
};

export const PAYMENT_METHODS = ['pix', 'cash', 'transfer'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  pix: 'PIX',
  cash: 'Dinheiro',
  transfer: 'Transferência',
};

export const NO_SHOW_RESOLUTIONS = ['rescheduled', 'written_off'] as const;
export type NoShowResolution = (typeof NO_SHOW_RESOLUTIONS)[number];

interface Payment {
  paidAt: Date;
  method: PaymentMethod;
  registeredBy: UserId;
}

/**
 * A venda (spec §4.9) e a máquina de estados da §4.11.
 *
 * O eixo de tudo é a regra 2.4: **pagamento antecipado é catraca**. Uma reserva `pre_reserved`
 * segura o horário e é INVISÍVEL para o Modelista — não existe para ele. Só depois do pagamento
 * registrado ela vira `confirmed` e entra na fila dele.
 *
 * O preço é um **snapshot** (2.9): `hourPrice` é o valor da máquina no dia da venda, copiado para
 * cá. Mudar o preço da máquina depois não mexe em reserva existente, e é isso que faz o
 * fechamento de um mês antigo continuar somando o mesmo valor.
 *
 * **Nenhuma transição automática por tempo** (regra 6.5): não existe job que expire pré-reserva.
 * O sistema mostra quanto falta e quantos esperam; liberar é ação humana do Administrativo.
 */
export class Reservation extends AggregateRoot {
  private constructor(
    private readonly _id: ReservationId,
    private readonly _accountId: AccountId,
    private readonly _scheduleEntryId: ScheduleEntryId,
    private readonly _preOrderId: PreOrderId,
    private readonly _customerId: CustomerId,
    private readonly _machineId: MachineId,
    private _hours: number,
    private readonly _hourPrice: Money,
    private _status: ReservationStatus,
    private _payment: Payment | null,
    private _noShowAt: Date | null,
    private _noShowResolution: NoShowResolution | null,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
  ) {
    super();
  }

  static create(input: {
    accountId: AccountId;
    scheduleEntryId: ScheduleEntryId;
    preOrderId: PreOrderId;
    customerId: CustomerId;
    machineId: MachineId;
    hours: number;
    /** O preço DA MÁQUINA escolhida, no momento da venda. Nunca um valor vindo do cliente HTTP. */
    hourPrice: Money;
  }): Reservation {
    if (!Number.isInteger(input.hours) || input.hours < 1) {
      throw new InvalidValueException('A reserva é vendida em horas inteiras, mínimo de 1.');
    }

    const now = new Date();
    return new Reservation(
      ReservationId.create(),
      input.accountId,
      input.scheduleEntryId,
      input.preOrderId,
      input.customerId,
      input.machineId,
      input.hours,
      input.hourPrice,
      // Nasce segurando o horário e invisível para o Modelista.
      'pre_reserved',
      null,
      null,
      null,
      now,
      now,
    );
  }

  static restore(input: {
    id: ReservationId;
    accountId: AccountId;
    scheduleEntryId: ScheduleEntryId;
    preOrderId: PreOrderId;
    customerId: CustomerId;
    machineId: MachineId;
    hours: number;
    hourPrice: Money;
    status: ReservationStatus;
    payment: Payment | null;
    noShowAt: Date | null;
    noShowResolution: NoShowResolution | null;
    createdAt: Date;
    updatedAt: Date;
  }): Reservation {
    return new Reservation(
      input.id,
      input.accountId,
      input.scheduleEntryId,
      input.preOrderId,
      input.customerId,
      input.machineId,
      input.hours,
      input.hourPrice,
      input.status,
      input.payment,
      input.noShowAt,
      input.noShowResolution,
      input.createdAt,
      input.updatedAt,
    );
  }

  /**
   * A reserva que nasce da **remarcação** de um no-show (§4.15).
   *
   * Nasce `confirmed` com o pagamento **copiado** da original: o dinheiro já entrou, e por isso a
   * nova reserva **não** gera `cash_entry`. Duplicar a entrada aqui inflaria o caixa do mês com
   * dinheiro que ninguém pagou duas vezes.
   *
   * Máquina, horas e `hourPrice` vêm da original de propósito: nenhum valor novo é cobrado, então
   * mudar o preço mudaria o total de uma venda já paga.
   */
  static rescheduleFrom(original: Reservation, scheduleEntryId: ScheduleEntryId): Reservation {
    if (original._status !== 'no_show') {
      throw new InvalidReservationTransitionException('remarcar', original._status);
    }
    if (!original._payment) {
      // Só chega aqui reserva que foi paga — `markNoShow` exige `confirmed`/`in_progress`.
      throw new InvalidValueException('Não há pagamento para transportar para a remarcação.');
    }

    const now = new Date();
    return new Reservation(
      ReservationId.create(),
      original._accountId,
      scheduleEntryId,
      original._preOrderId,
      original._customerId,
      original._machineId,
      original._hours,
      original._hourPrice,
      'confirmed',
      { ...original._payment },
      null,
      null,
      now,
      now,
    );
  }

  /**
   * O pagamento é a catraca. É este método — e só ele — que faz a reserva aparecer para o
   * Modelista.
   */
  registerPayment(input: { method: PaymentMethod; registeredBy: UserId; at?: Date }): void {
    if (this._status !== 'pre_reserved') {
      throw new InvalidReservationTransitionException('registrar o pagamento', this._status);
    }

    this._payment = {
      paidAt: input.at ?? new Date(),
      method: input.method,
      registeredBy: input.registeredBy,
    };
    this._status = 'confirmed';
    this.touch();
  }

  /**
   * Libera o horário para a fila de espera. Só a partir de `pre_reserved` — reserva paga não se
   * "libera", se cancela.
   *
   * Ação humana, sempre (regra 6.5).
   */
  release(): void {
    if (this._status !== 'pre_reserved') {
      throw new InvalidReservationTransitionException('liberar o horário', this._status);
    }
    this._status = 'released';
    this.touch();
  }

  /** Cancelamento pelo Administrativo, a partir de `pre_reserved` ou `confirmed` (§4.11). */
  cancel(): void {
    if (this._status !== 'pre_reserved' && this._status !== 'confirmed') {
      throw new InvalidReservationTransitionException('cancelar', this._status);
    }
    this._status = 'cancelled';
    this.touch();
  }

  /** Primeiro start de matriz (Fase 5). */
  markInProgress(): void {
    if (this._status !== 'confirmed') {
      throw new InvalidReservationTransitionException('iniciar a execução', this._status);
    }
    this._status = 'in_progress';
    this.touch();
  }

  /** O Modelista encerra a reserva (Fase 5). */
  complete(): void {
    if (this._status !== 'in_progress') {
      throw new InvalidReservationTransitionException('concluir', this._status);
    }
    this._status = 'completed';
    this.touch();
  }

  /**
   * "Não compareceu" — tira da agenda e cria pendência para o Administrativo.
   *
   * **Não decide nada sozinho** (regra 6.9): não dá crédito automático nem baixa automática. Quem
   * escolhe entre remarcar e dar baixa é o Administrativo, conforme contrato.
   *
   * Aceita a partir de `confirmed` (o cliente pagou e não veio) e de `in_progress` — o diagrama da
   * §4.11 mostra a segunda, e a primeira é o caso comum.
   */
  markNoShow(at: Date = new Date()): void {
    if (this._status !== 'confirmed' && this._status !== 'in_progress') {
      throw new InvalidReservationTransitionException('marcar não comparecimento', this._status);
    }
    this._status = 'no_show';
    this._noShowAt = at;
    this.touch();
  }

  /** Resolução do no-show: `rescheduled` ou `written_off`. Só `admin`/`owner` chegam aqui (§5). */
  resolveNoShow(resolution: NoShowResolution): void {
    if (this._status !== 'no_show') {
      throw new InvalidReservationTransitionException(
        'resolver o não comparecimento',
        this._status,
      );
    }
    if (this._noShowResolution) {
      throw new InvalidReservationTransitionException(
        'resolver o não comparecimento novamente',
        this._status,
      );
    }
    this._noShowResolution = resolution;
    this.touch();
  }

  /** Uma reserva só aparece para o Modelista nestes dois estados (§5). */
  get isVisibleToModelista(): boolean {
    return this._status === 'confirmed' || this._status === 'in_progress';
  }

  /** `hours × hourPrice`. Calculado, nunca digitado — e o banco confere com um CHECK. */
  get total(): Money {
    return this._hourPrice.multiply(this._hours);
  }

  private touch(): void {
    this._updatedAt = new Date();
  }

  get id(): ReservationId {
    return this._id;
  }

  get accountId(): AccountId {
    return this._accountId;
  }

  get scheduleEntryId(): ScheduleEntryId {
    return this._scheduleEntryId;
  }

  get preOrderId(): PreOrderId {
    return this._preOrderId;
  }

  get customerId(): CustomerId {
    return this._customerId;
  }

  get machineId(): MachineId {
    return this._machineId;
  }

  get hours(): number {
    return this._hours;
  }

  get hourPrice(): Money {
    return this._hourPrice;
  }

  get status(): ReservationStatus {
    return this._status;
  }

  get payment(): Payment | null {
    return this._payment;
  }

  get noShowAt(): Date | null {
    return this._noShowAt;
  }

  get noShowResolution(): NoShowResolution | null {
    return this._noShowResolution;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }
}
