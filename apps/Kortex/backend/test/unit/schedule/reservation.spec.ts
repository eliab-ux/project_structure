import { Reservation } from '../../../src/contexts/schedule/domain/entities/reservation.entity';
import { ReservationForModelistaDto } from '../../../src/contexts/schedule/application/dto/schedule.dto';
import { AccountId } from '../../../src/contexts/account/domain/value-objects/account-id.vo';
import { ScheduleEntryId } from '../../../src/contexts/schedule/domain/value-objects/schedule-entry-id.vo';
import { PreOrderId } from '../../../src/contexts/pre-order/domain/value-objects/pre-order-id.vo';
import { CustomerId } from '../../../src/contexts/customer/domain/value-objects/customer-id.vo';
import { MachineId } from '../../../src/contexts/machine/domain/value-objects/machine-id.vo';
import { UserId } from '../../../src/contexts/user/domain/value-objects/user-id.vo';
import { Money } from '../../../src/shared/domain/value-objects/money.vo';
import { InvalidReservationTransitionException } from '../../../src/contexts/schedule/domain/exceptions/schedule.exceptions';

const admin = UserId.create();

function build(hours = 3, priceCents = 8500): Reservation {
  return Reservation.create({
    accountId: AccountId.create(),
    scheduleEntryId: ScheduleEntryId.create(),
    preOrderId: PreOrderId.create(),
    customerId: CustomerId.create(),
    machineId: MachineId.create(),
    hours,
    hourPrice: Money.fromCents(priceCents),
  });
}

function paid(): Reservation {
  const reservation = build();
  reservation.registerPayment({ method: 'pix', registeredBy: admin });
  return reservation;
}

describe('Reservation — pagamento é catraca (regra 2.4)', () => {
  it('nasce pré-reservada e INVISÍVEL para o Modelista', () => {
    const reservation = build();
    expect(reservation.status).toBe('pre_reserved');
    expect(reservation.isVisibleToModelista).toBe(false);
  });

  it('só aparece para o Modelista depois do pagamento', () => {
    const reservation = paid();
    expect(reservation.status).toBe('confirmed');
    expect(reservation.isVisibleToModelista).toBe(true);
  });

  it('o pagamento guarda forma, data e quem registrou', () => {
    const reservation = paid();
    expect(reservation.payment?.method).toBe('pix');
    expect(reservation.payment?.registeredBy.value).toBe(admin.value);
    expect(reservation.payment?.paidAt).toBeInstanceOf(Date);
  });

  it('não registra pagamento duas vezes', () => {
    const reservation = paid();
    expect(() => reservation.registerPayment({ method: 'cash', registeredBy: admin })).toThrow(
      InvalidReservationTransitionException,
    );
  });
});

describe('Reservation — preço e total', () => {
  it('total é horas × preço da hora, calculado e nunca digitado', () => {
    expect(build(3, 8500).total.cents).toBe(25500);
    expect(build(1, 4000).total.cents).toBe(4000);
  });

  it('máquinas com preços diferentes geram valores diferentes', () => {
    expect(build(2, 8500).total.cents).toBe(17000);
    expect(build(2, 4000).total.cents).toBe(8000);
  });

  it('o snapshot não muda depois — não há setter de preço', () => {
    const reservation = build(2, 8500);
    expect(Object.getOwnPropertyNames(Reservation.prototype)).not.toContain('changeHourPrice');
    expect(reservation.hourPrice.cents).toBe(8500);
  });

  it('recusa horas fracionadas', () => {
    expect(() => build(2.5)).toThrow();
    expect(() => build(0)).toThrow();
  });
});

describe('Reservation — máquina de estados (§4.11)', () => {
  it('liberar só a partir de pré-reservada', () => {
    const pre = build();
    pre.release();
    expect(pre.status).toBe('released');

    expect(() => paid().release()).toThrow(InvalidReservationTransitionException);
  });

  it('cancelar vale de pré-reservada e de paga', () => {
    const pre = build();
    pre.cancel();
    expect(pre.status).toBe('cancelled');

    const confirmada = paid();
    confirmada.cancel();
    expect(confirmada.status).toBe('cancelled');
  });

  it('execução começa só depois do pagamento', () => {
    expect(() => build().markInProgress()).toThrow(InvalidReservationTransitionException);

    const reservation = paid();
    reservation.markInProgress();
    expect(reservation.status).toBe('in_progress');
    expect(reservation.isVisibleToModelista).toBe(true);
  });

  it('conclui só a partir de em execução', () => {
    const reservation = paid();
    expect(() => reservation.complete()).toThrow(InvalidReservationTransitionException);

    reservation.markInProgress();
    reservation.complete();
    expect(reservation.status).toBe('completed');
    // Concluída sai da fila do Modelista.
    expect(reservation.isVisibleToModelista).toBe(false);
  });

  it('não comparecimento NÃO decide nada sozinho (regra 6.9)', () => {
    const reservation = paid();
    reservation.markNoShow(new Date('2026-09-07T13:00:00.000Z'));

    expect(reservation.status).toBe('no_show');
    expect(reservation.noShowAt?.toISOString()).toBe('2026-09-07T13:00:00.000Z');
    // A resolução fica em aberto: quem escolhe é o Administrativo.
    expect(reservation.noShowResolution).toBeNull();
  });

  it('a resolução do no-show é escolhida, e só uma vez', () => {
    const reservation = paid();
    reservation.markNoShow();
    reservation.resolveNoShow('rescheduled');

    expect(reservation.noShowResolution).toBe('rescheduled');
    expect(() => reservation.resolveNoShow('written_off')).toThrow(
      InvalidReservationTransitionException,
    );
  });

  it('não marca no-show em reserva não paga', () => {
    expect(() => build().markNoShow()).toThrow(InvalidReservationTransitionException);
  });
});

describe('ReservationForModelistaDto — sem NENHUM campo monetário (§5)', () => {
  const refs = {
    customer: { id: 'c', name: 'Malharia São Bento' },
    machine: { id: 'm', name: 'Máquina 01' },
    startsAt: new Date('2026-09-07T10:00:00.000Z'),
    endsAt: new Date('2026-09-07T13:00:00.000Z'),
  };

  it('não mapeia preço, total, pagamento nem quem registrou', () => {
    const dto = ReservationForModelistaDto.fromDomain(paid(), refs);
    const campos = Object.keys(dto);

    expect(campos).not.toContain('hourPriceCents');
    expect(campos).not.toContain('totalCents');
    expect(campos).not.toContain('paidAt');
    expect(campos).not.toContain('paymentMethod');
    expect(campos).not.toContain('paidRegisteredBy');
  });

  it('o valor não aparece nem serializado — não há o que achar no DevTools', () => {
    const serialized = JSON.stringify(ReservationForModelistaDto.fromDomain(paid(), refs));
    expect(serialized).not.toContain('8500');
    expect(serialized).not.toContain('25500');
    expect(serialized).not.toContain('pix');
  });

  it('expõe exatamente o que ele precisa para trabalhar', () => {
    expect(Object.keys(ReservationForModelistaDto.fromDomain(paid(), refs)).sort()).toEqual([
      'customer',
      'endsAt',
      'hours',
      'id',
      'machine',
      'preOrderId',
      'startsAt',
      'status',
    ]);
  });
});

describe('Reservation — remarcação de no-show (§4.15)', () => {
  function noShow(): Reservation {
    const reservation = paid();
    reservation.markNoShow();
    return reservation;
  }

  it('a nova reserva nasce PAGA, com o pagamento da original', () => {
    const original = noShow();
    const nova = Reservation.rescheduleFrom(original, ScheduleEntryId.create());

    expect(nova.status).toBe('confirmed');
    expect(nova.payment?.paidAt).toEqual(original.payment?.paidAt);
    expect(nova.payment?.method).toBe('pix');
    // O dinheiro já entrou na venda original: nada aqui gera lançamento novo.
    expect(nova.isVisibleToModelista).toBe(true);
  });

  it('carrega máquina, horas e preço da original — nada novo é cobrado', () => {
    const original = noShow();
    const nova = Reservation.rescheduleFrom(original, ScheduleEntryId.create());

    expect(nova.machineId.value).toBe(original.machineId.value);
    expect(nova.customerId.value).toBe(original.customerId.value);
    expect(nova.preOrderId.value).toBe(original.preOrderId.value);
    expect(nova.hours).toBe(original.hours);
    expect(nova.total.cents).toBe(original.total.cents);
  });

  it('é uma reserva NOVA, com id e horário próprios', () => {
    const original = noShow();
    const entryId = ScheduleEntryId.create();
    const nova = Reservation.rescheduleFrom(original, entryId);

    expect(nova.id.value).not.toBe(original.id.value);
    expect(nova.scheduleEntryId.value).toBe(entryId.value);
    expect(nova.noShowAt).toBeNull();
    expect(nova.noShowResolution).toBeNull();
  });

  it('só remarca a partir de no_show', () => {
    expect(() => Reservation.rescheduleFrom(paid(), ScheduleEntryId.create())).toThrow(
      InvalidReservationTransitionException,
    );
  });
});
