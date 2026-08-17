import { WaitingListEntry } from '../../../src/contexts/waiting-list/domain/entities/waiting-list-entry.entity';
import { SlotNotice } from '../../../src/contexts/waiting-list/domain/entities/slot-notice.entity';
import { AccountId } from '../../../src/contexts/account/domain/value-objects/account-id.vo';
import { CustomerId } from '../../../src/contexts/customer/domain/value-objects/customer-id.vo';
import { UserId } from '../../../src/contexts/user/domain/value-objects/user-id.vo';
import { InvalidValueException } from '../../../src/shared/domain/exceptions/invalid-value.exception';
import { InvalidWaitingListTransitionException } from '../../../src/contexts/waiting-list/domain/exceptions/waiting-list.exceptions';

const accountId = AccountId.create();
const customerId = CustomerId.create();

function build(overrides: Partial<Parameters<typeof WaitingListEntry.create>[0]> = {}) {
  return WaitingListEntry.create({
    accountId,
    customerId,
    preOrderId: null,
    fabricId: null,
    productTypeId: null,
    hoursNeeded: 3,
    technicalNotes: 'Malha, enfesto alto',
    wantsEarlier: true,
    desiredUntil: null,
    ...overrides,
  });
}

describe('WaitingListEntry', () => {
  it('nasce esperando, sem oferta e sem aceite', () => {
    const entry = build();
    expect(entry.status).toBe('waiting');
    expect(entry.offeredAt).toBeNull();
    expect(entry.customerAcceptedAt).toBeNull();
  });

  it('exige horas inteiras de 1 ou mais', () => {
    expect(() => build({ hoursNeeded: 0 })).toThrow(InvalidValueException);
    expect(() => build({ hoursNeeded: 1.5 })).toThrow(InvalidValueException);
  });

  describe('fluxo da vaga (regra 6.3 — pagamento é catraca)', () => {
    it('oferecer marca a data e NÃO cria reserva', () => {
      const entry = build();
      entry.offer(new Date('2026-08-15T10:00:00.000Z'));

      expect(entry.status).toBe('offered');
      expect(entry.offeredAt?.toISOString()).toBe('2026-08-15T10:00:00.000Z');
      // Continua "offered": a reserva nasce no ato do pagamento, na Fase 4.
      expect(entry.customerAcceptedAt).toBeNull();
    });

    it('o aceite do cliente é registro, não conversão', () => {
      const entry = build();
      entry.offer();
      entry.registerCustomerAcceptance(new Date('2026-08-15T10:05:00.000Z'));

      expect(entry.customerAcceptedAt?.toISOString()).toBe('2026-08-15T10:05:00.000Z');
      // O status NÃO virou 'converted' — falta o pagamento.
      expect(entry.status).toBe('offered');
    });

    it('só converte depois de oferecida', () => {
      const entry = build();
      expect(() => entry.markConverted()).toThrow(InvalidWaitingListTransitionException);

      entry.offer();
      entry.markConverted();
      expect(entry.status).toBe('converted');
    });

    it('não registra aceite de quem não recebeu oferta', () => {
      expect(() => build().registerCustomerAcceptance()).toThrow(
        InvalidWaitingListTransitionException,
      );
    });

    it('não oferece duas vezes', () => {
      const entry = build();
      entry.offer();
      expect(() => entry.offer()).toThrow(InvalidWaitingListTransitionException);
    });

    it('convertida não sai da fila nem é editada', () => {
      const entry = build();
      entry.offer();
      entry.markConverted();

      expect(() => entry.drop()).toThrow(InvalidWaitingListTransitionException);
      expect(() =>
        entry.update({
          customerId,
          preOrderId: null,
          fabricId: null,
          productTypeId: null,
          hoursNeeded: 4,
          wantsEarlier: false,
          desiredUntil: null,
        }),
      ).toThrow(InvalidWaitingListTransitionException);
    });

    it('desistência sai da fila a partir de esperando ou oferecida', () => {
      const esperando = build();
      esperando.drop();
      expect(esperando.status).toBe('dropped');

      const oferecida = build();
      oferecida.offer();
      oferecida.drop();
      expect(oferecida.status).toBe('dropped');
    });
  });
});

describe('SlotNotice — aviso, não agendamento (regra 6.3)', () => {
  const createdBy = UserId.create();

  it('guarda quem avisou, quando e o recado', () => {
    const notice = SlotNotice.create({
      accountId,
      createdByUserId: createdBy,
      note: 'Vagou às 14h',
    });

    expect(notice.status).toBe('open');
    expect(notice.createdByUserId.value).toBe(createdBy.value);
    expect(notice.note).toBe('Vagou às 14h');
  });

  it('NÃO tem máquina, horário nem cliente — isso seria agendamento', () => {
    const notice = SlotNotice.create({ accountId, createdByUserId: createdBy, note: 'Vagou' });
    const campos = Object.getOwnPropertyNames(notice).map((f) => f.replace(/^_/, ''));

    expect(campos).not.toContain('machineId');
    expect(campos).not.toContain('customerId');
    expect(campos).not.toContain('startsAt');
  });

  it('exige recado de verdade', () => {
    expect(() => SlotNotice.create({ accountId, createdByUserId: createdBy, note: 'ok' })).toThrow(
      InvalidValueException,
    );
    expect(() =>
      SlotNotice.create({ accountId, createdByUserId: createdBy, note: 'a'.repeat(501) }),
    ).toThrow(InvalidValueException);
  });

  it('marcar como tratado registra quem resolveu', () => {
    const notice = SlotNotice.create({
      accountId,
      createdByUserId: createdBy,
      note: 'Vagou às 14h',
    });
    const admin = UserId.create();

    notice.markHandled(admin, new Date('2026-08-15T11:00:00.000Z'));

    expect(notice.status).toBe('handled');
    expect(notice.handledByUserId?.value).toBe(admin.value);
    expect(notice.handledAt?.toISOString()).toBe('2026-08-15T11:00:00.000Z');
  });
});
