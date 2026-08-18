import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  RESERVATION_REPOSITORY,
  ReservationRepositoryPort,
  SCHEDULE_ENTRY_REPOSITORY,
  ScheduleEntryRepositoryPort,
} from '../ports/output/schedule-repository.port';
import {
  BUSINESS_HOUR_REPOSITORY,
  BusinessHourRepositoryPort,
} from '../../../account/application/ports/output/business-hour-repository.port';
import {
  ACCOUNT_REPOSITORY,
  AccountRepositoryPort,
} from '../../../account/application/ports/output/account-repository.port';
import { AccountNotFoundException } from '../../../account/domain/exceptions/account-not-found.exception';
import {
  MACHINE_REPOSITORY,
  MachineRepositoryPort,
} from '../../../machine/application/ports/output/machine-repository.port';
import {
  PRE_ORDER_REPOSITORY,
  PreOrderRepositoryPort,
} from '../../../pre-order/application/ports/output/pre-order-repository.port';
import { CASH_RECORDER, CashRecorderPort } from '../ports/output/cash-recorder.port';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../infrastructure/persistence/ports/unit-of-work.port';
import {
  ReservationDto,
  ReservationForModelistaDto,
  ScheduleEntryDto,
  ScheduleEntryWithWarningsDto,
} from '../dto/schedule.dto';
import {
  ReferenceResolver,
  refOrPlaceholder,
} from '../../../pre-order/application/reference-resolver';
import { NamedRef } from '../../../pre-order/application/dto/pre-order.dto';
import { ScheduleEntry } from '../../domain/entities/schedule-entry.entity';
import {
  NoShowResolution,
  PaymentMethod,
  Reservation,
} from '../../domain/entities/reservation.entity';
import {
  InactiveMachineException,
  ReservationNotFoundException,
  RescheduleDurationMismatchException,
  ScheduleEntryNotFoundException,
} from '../../domain/exceptions/schedule.exceptions';
import { ScheduleEntryId } from '../../domain/value-objects/schedule-entry-id.vo';
import { ReservationId } from '../../domain/value-objects/reservation-id.vo';
import { AccountId } from '../../../account/domain/value-objects/account-id.vo';
import { MachineId } from '../../../machine/domain/value-objects/machine-id.vo';
import { CustomerId } from '../../../customer/domain/value-objects/customer-id.vo';
import { PreOrderId } from '../../../pre-order/domain/value-objects/pre-order-id.vo';
import { UserId } from '../../../user/domain/value-objects/user-id.vo';
import { PreOrderNotFoundException } from '../../../pre-order/domain/exceptions/pre-order.exceptions';
import { MachineNotFoundException } from '../../../machine/domain/exceptions/machine-not-found.exception';

export interface CreateReservationInput {
  machineId: string;
  preOrderId: string;
  startsAt: string;
  endsAt: string;
}

export interface CreateConsultationInput {
  title: string;
  customerId?: string | null;
  startsAt: string;
  endsAt: string;
}

@Injectable()
export class ScheduleUseCases {
  private readonly logger = new Logger(ScheduleUseCases.name);

  constructor(
    @Inject(SCHEDULE_ENTRY_REPOSITORY)
    private readonly entries: ScheduleEntryRepositoryPort,
    @Inject(RESERVATION_REPOSITORY)
    private readonly reservations: ReservationRepositoryPort,
    @Inject(BUSINESS_HOUR_REPOSITORY)
    private readonly businessHours: BusinessHourRepositoryPort,
    // A agenda precisa do fuso da conta: janela é horário local, `starts_at` é instante.
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accounts: AccountRepositoryPort,
    @Inject(MACHINE_REPOSITORY)
    private readonly machines: MachineRepositoryPort,
    @Inject(PRE_ORDER_REPOSITORY)
    private readonly preOrders: PreOrderRepositoryPort,
    private readonly references: ReferenceResolver,
    @Inject(CASH_RECORDER)
    private readonly cashRecorder: CashRecorderPort,
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  /** Grade da agenda do Administrativo — os dois tipos, com o status da reserva quando houver. */
  async listAgenda(accountId: string, from: string, to: string): Promise<ScheduleEntryDto[]> {
    const account = AccountId.from(accountId);
    const entries = await this.entries.listInRange(account, new Date(from), new Date(to));
    return this.toEntryDtos(account, entries);
  }

  /**
   * Cria a hora de máquina E a reserva, no mesmo ato.
   *
   * As duas nascem juntas porque uma sem a outra não faz sentido: um `machine_hour` na agenda sem
   * reserva seria um horário ocupado que ninguém comprou. A reserva nasce `pre_reserved` —
   * invisível para o Modelista até o pagamento (regra 2.4).
   *
   * O **preço vem da máquina**, buscado aqui (decisão 2.9). Nunca do corpo da requisição: aceitar
   * um valor do cliente HTTP seria deixar o comprador escolher o preço.
   */
  async createReservation(
    accountId: string,
    input: CreateReservationInput,
  ): Promise<ReservationDto> {
    const account = AccountId.from(accountId);

    const machine = await this.machines.findById(account, MachineId.from(input.machineId));
    if (!machine) {
      throw new MachineNotFoundException();
    }
    if (!machine.isActive) {
      throw new InactiveMachineException();
    }

    const preOrder = await this.preOrders.findById(account, PreOrderId.from(input.preOrderId));
    if (!preOrder) {
      throw new PreOrderNotFoundException();
    }

    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);

    const windows = await this.businessHours.listByAccount(account);
    const { entry, hours } = ScheduleEntry.createMachineHour({
      accountId: account,
      machineId: machine.id,
      startsAt,
      endsAt,
      customerId: preOrder.customerId,
      businessHours: windows,
      timeZone: await this.timeZoneOf(account),
    });

    // Checagem em memória para dar a mensagem que o operador entende. A garantia de verdade é a
    // constraint de exclusão no banco — entre este select e o insert cabe outra requisição.
    const sameRange = await this.entries.listInRange(account, startsAt, endsAt);
    entry.assertNoMachineOverlap(sameRange);

    const reservation = Reservation.create({
      accountId: account,
      scheduleEntryId: entry.id,
      preOrderId: preOrder.id,
      customerId: preOrder.customerId,
      machineId: machine.id,
      hours,
      hourPrice: machine.hourPrice,
    });

    // O pré-pedido vira reserva e para de ser editável.
    preOrder.markReserved();

    const saved = await this.unitOfWork.execute(async () => {
      await this.entries.save(entry);
      await this.preOrders.save(preOrder);
      return this.reservations.save(reservation);
    });

    this.logger.log('Reserva criada', {
      reservationId: saved.id.value,
      machineId: machine.id.value,
      hours,
    });

    return (await this.toReservationDtos(account, [saved]))[0];
  }

  /**
   * Atendimento na agenda. Pode sobrepor qualquer coisa — devolve `warnings` e a UI alerta; o
   * Administrativo decide (regra 6.10).
   */
  async createConsultation(
    accountId: string,
    input: CreateConsultationInput,
  ): Promise<ScheduleEntryWithWarningsDto> {
    const account = AccountId.from(accountId);
    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);

    const entry = ScheduleEntry.createConsultation({
      accountId: account,
      startsAt,
      endsAt,
      title: input.title,
      customerId: input.customerId ? CustomerId.from(input.customerId) : null,
    });

    const sameRange = await this.entries.listInRange(account, startsAt, endsAt);
    const warnings = entry.collectOverlapWarnings(sameRange);

    const saved = await this.unitOfWork.execute(async () => this.entries.save(entry));
    const dto = (await this.toEntryDtos(account, [saved]))[0];

    return ScheduleEntryWithWarningsDto.create(dto, warnings);
  }

  async removeConsultation(accountId: string, entryId: string): Promise<void> {
    const account = AccountId.from(accountId);
    const id = ScheduleEntryId.from(entryId);

    const entry = await this.entries.findById(account, id);
    if (!entry || entry.type !== 'consultation') {
      // Hora de máquina não se apaga da agenda: ela tem reserva, e reserva se cancela.
      throw new ScheduleEntryNotFoundException();
    }

    await this.unitOfWork.execute(async () => this.entries.delete(account, id));
  }

  // ==== Reservas ====

  async listReservations(accountId: string): Promise<ReservationDto[]> {
    const account = AccountId.from(accountId);
    return this.toReservationDtos(account, await this.reservations.listByAccount(account));
  }

  /**
   * A fila do Modelista.
   *
   * Duas barreiras independentes: o **repositório** só devolve `confirmed`/`in_progress`, e o
   * **DTO** não tem campo monetário nenhum. Uma reserva `pre_reserved` não existe para ele.
   */
  async listQueueForModelista(accountId: string): Promise<ReservationForModelistaDto[]> {
    const account = AccountId.from(accountId);
    const reservations = await this.reservations.listVisibleToModelista(account);

    if (reservations.length === 0) {
      return [];
    }

    const refs = await this.references.load(account);
    const machines = await this.machineRefs(account);
    const entries = await this.entriesById(account, reservations);

    return reservations.map((reservation) => {
      const entry = entries.get(reservation.scheduleEntryId.value);
      return ReservationForModelistaDto.fromDomain(reservation, {
        customer: refOrPlaceholder(refs.customers, reservation.customerId.value),
        machine: refOrPlaceholder(machines, reservation.machineId.value),
        startsAt: entry?.startsAt ?? reservation.createdAt,
        endsAt: entry?.endsAt ?? reservation.createdAt,
      });
    });
  }

  /**
   * O pagamento é a catraca: é aqui que a reserva passa a existir para o Modelista.
   *
   * E é **um ato só** (§4.15): a entrada de caixa nasce dentro da MESMA transação. Se a entrada
   * falhar, o pagamento não é gravado — melhor a reserva continuar `pre_reserved` e o operador
   * tentar de novo do que ter dinheiro recebido que o caixa não conhece.
   */
  async registerPayment(
    accountId: string,
    reservationId: string,
    method: PaymentMethod,
    registeredBy: string,
    bankAccountId?: string | null,
  ): Promise<ReservationDto> {
    const account = AccountId.from(accountId);

    const reservation = await this.reservations.findById(
      account,
      ReservationId.from(reservationId),
    );
    if (!reservation) {
      throw new ReservationNotFoundException();
    }

    reservation.registerPayment({ method, registeredBy: UserId.from(registeredBy) });

    const refs = await this.references.load(account);
    const customer = refOrPlaceholder(refs.customers, reservation.customerId.value);

    const saved = await this.unitOfWork.execute(async () => {
      const persisted = await this.reservations.save(reservation);
      await this.cashRecorder.recordReservationPayment({
        accountId,
        reservationId: persisted.id.value,
        amountCents: persisted.total.cents,
        paymentMethod: method,
        // Regime de caixa: a data em que o dinheiro entrou, não a da reserva (§4.15).
        occurredOn: persisted.payment?.paidAt ?? new Date(),
        description: `Hora de máquina — ${customer.name}`,
        registeredBy,
        bankAccountId,
      });
      return persisted;
    });

    return (await this.toReservationDtos(account, [saved]))[0];
  }

  /** Liberar o horário para a fila. Ação humana, sempre (regra 6.5). */
  async release(accountId: string, reservationId: string): Promise<ReservationDto> {
    return this.mutate(accountId, reservationId, (reservation) => reservation.release());
  }

  async cancel(accountId: string, reservationId: string): Promise<ReservationDto> {
    return this.mutate(accountId, reservationId, (reservation) => reservation.cancel());
  }

  /** Marcar "não compareceu" — cria a pendência e não decide nada (regra 6.9). */
  async markNoShow(accountId: string, reservationId: string): Promise<ReservationDto> {
    return this.mutate(accountId, reservationId, (reservation) => reservation.markNoShow());
  }

  /** Resolver o no-show. Só `admin`/`owner` alcançam a rota (§5). */
  async resolveNoShow(
    accountId: string,
    reservationId: string,
    resolution: NoShowResolution,
  ): Promise<ReservationDto> {
    return this.mutate(accountId, reservationId, (reservation) =>
      reservation.resolveNoShow(resolution),
    );
  }

  /**
   * Remarcação de no-show: resolve a pendência E cria a reserva nova, no mesmo ato.
   *
   * **Não gera segunda entrada de caixa** (§4.15) — o dinheiro já entrou na venda original. A nova
   * reserva nasce paga porque `Reservation.rescheduleFrom` copia o pagamento; nada aqui chama o
   * `CashRecorderPort`, e a ausência da chamada é a regra em si.
   *
   * Mesma máquina e mesmas horas da original: nada novo é cobrado, então o total não pode mudar.
   */
  async rescheduleNoShow(
    accountId: string,
    reservationId: string,
    input: { startsAt: string; endsAt: string },
  ): Promise<ReservationDto> {
    const account = AccountId.from(accountId);

    const original = await this.reservations.findById(account, ReservationId.from(reservationId));
    if (!original) {
      throw new ReservationNotFoundException();
    }

    const machine = await this.machines.findById(account, original.machineId);
    if (!machine) {
      throw new MachineNotFoundException();
    }
    if (!machine.isActive) {
      throw new InactiveMachineException();
    }

    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);

    const windows = await this.businessHours.listByAccount(account);
    const { entry, hours } = ScheduleEntry.createMachineHour({
      accountId: account,
      machineId: machine.id,
      startsAt,
      endsAt,
      customerId: original.customerId,
      businessHours: windows,
      timeZone: await this.timeZoneOf(account),
    });

    if (hours !== original.hours) {
      throw new RescheduleDurationMismatchException(original.hours, hours);
    }

    const sameRange = await this.entries.listInRange(account, startsAt, endsAt);
    entry.assertNoMachineOverlap(sameRange);

    const rescheduled = Reservation.rescheduleFrom(original, entry.id);
    original.resolveNoShow('rescheduled');

    const saved = await this.unitOfWork.execute(async () => {
      await this.entries.save(entry);
      await this.reservations.save(original);
      return this.reservations.save(rescheduled);
    });

    this.logger.log('No-show remarcado — sem nova entrada de caixa', {
      originalId: original.id.value,
      reservationId: saved.id.value,
    });

    return (await this.toReservationDtos(account, [saved]))[0];
  }

  private async mutate(
    accountId: string,
    reservationId: string,
    change: (reservation: Reservation) => void,
  ): Promise<ReservationDto> {
    const account = AccountId.from(accountId);

    const reservation = await this.reservations.findById(
      account,
      ReservationId.from(reservationId),
    );
    if (!reservation) {
      throw new ReservationNotFoundException();
    }

    change(reservation);

    const saved = await this.unitOfWork.execute(async () => this.reservations.save(reservation));
    return (await this.toReservationDtos(account, [saved]))[0];
  }

  /**
   * O fuso da conta — o relógio pelo qual a agenda inteira é lida.
   *
   * Uma consulta a mais por criação de reserva, e não vale cachear: a agenda é o lugar onde um
   * fuso desatualizado deslocaria todo horário em uma hora sem erro nenhum aparecer.
   */
  private async timeZoneOf(accountId: AccountId): Promise<string> {
    const account = await this.accounts.findById(accountId);
    if (!account) {
      throw new AccountNotFoundException();
    }
    return account.timezone;
  }

  // ==== Montagem dos DTOs ====

  private async machineRefs(accountId: AccountId): Promise<Map<string, NamedRef>> {
    const machines = await this.machines.listByAccount(accountId);
    // Só id e nome: `MachineDto` carrega `hourPriceCents`, e este mapa alimenta também o DTO do
    // Modelista.
    return new Map(
      machines.map((machine) => [machine.id.value, { id: machine.id.value, name: machine.name }]),
    );
  }

  private async entriesById(
    accountId: AccountId,
    reservations: Reservation[],
  ): Promise<Map<string, ScheduleEntry>> {
    const found = await Promise.all(
      reservations.map((reservation) =>
        this.entries.findById(accountId, reservation.scheduleEntryId),
      ),
    );
    return new Map(
      found
        .filter((entry): entry is ScheduleEntry => entry !== null)
        .map((entry) => [entry.id.value, entry]),
    );
  }

  private async toEntryDtos(
    accountId: AccountId,
    entries: ScheduleEntry[],
  ): Promise<ScheduleEntryDto[]> {
    if (entries.length === 0) {
      return [];
    }

    const refs = await this.references.load(accountId);
    const machines = await this.machineRefs(accountId);

    return Promise.all(
      entries.map(async (entry) => {
        const reservation =
          entry.type === 'machine_hour'
            ? await this.reservations.findByScheduleEntry(accountId, entry.id)
            : null;

        return ScheduleEntryDto.fromDomain(entry, {
          machine: entry.machineId ? refOrPlaceholder(machines, entry.machineId.value) : null,
          customer: entry.customerId
            ? refOrPlaceholder(refs.customers, entry.customerId.value)
            : null,
          reservation: reservation
            ? { id: reservation.id.value, status: reservation.status }
            : null,
        });
      }),
    );
  }

  private async toReservationDtos(
    accountId: AccountId,
    reservations: Reservation[],
  ): Promise<ReservationDto[]> {
    if (reservations.length === 0) {
      return [];
    }

    const refs = await this.references.load(accountId);
    const machines = await this.machineRefs(accountId);
    const entries = await this.entriesById(accountId, reservations);

    return reservations.map((reservation) => {
      const entry = entries.get(reservation.scheduleEntryId.value);
      return ReservationDto.fromDomain(reservation, {
        customer: refOrPlaceholder(refs.customers, reservation.customerId.value),
        machine: refOrPlaceholder(machines, reservation.machineId.value),
        paidRegisteredBy: reservation.payment
          ? refOrPlaceholder(refs.users, reservation.payment.registeredBy.value)
          : null,
        startsAt: entry?.startsAt ?? reservation.createdAt,
        endsAt: entry?.endsAt ?? reservation.createdAt,
      });
    });
  }
}
