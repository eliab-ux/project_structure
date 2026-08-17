import { AggregateRoot } from '@gitspread/domain-primitives';
import { InvalidValueException } from '../../../../shared/domain/exceptions/invalid-value.exception';
import { AccountId } from '../../../account/domain/value-objects/account-id.vo';
import { UserId } from '../../../user/domain/value-objects/user-id.vo';
import { SlotNoticeId } from '../value-objects/slot-notice-id.vo';

export const SLOT_NOTICE_STATUSES = ['open', 'handled'] as const;
export type SlotNoticeStatus = (typeof SLOT_NOTICE_STATUSES)[number];

/**
 * O aviso de vaga: "vagou horário, olha a fila".
 *
 * É **aviso, não agendamento** (regra 6.3). O Modelista enxerga que abriu um espaço e chama o
 * Administrativo; quem escolhe da fila, liga, cobra e registra pago é o Administrativo — e só
 * depois disso a reserva aparece para o Modelista.
 *
 * Por isso a entidade não tem máquina, nem horário, nem cliente: cada um desses campos seria um
 * passo de agendamento entrando pela porta dos fundos. Ela tem quem avisou, quando, o recado, e
 * se já foi tratado.
 *
 * Não consta do modelo de domínio da spec — vem do DoD da Fase 3 e da regra 6.3.
 */
export class SlotNotice extends AggregateRoot {
  private constructor(
    private readonly _id: SlotNoticeId,
    private readonly _accountId: AccountId,
    private readonly _createdByUserId: UserId,
    private readonly _note: string,
    private _status: SlotNoticeStatus,
    private _handledByUserId: UserId | null,
    private _handledAt: Date | null,
    private readonly _createdAt: Date,
  ) {
    super();
  }

  static create(input: {
    accountId: AccountId;
    createdByUserId: UserId;
    note: string;
  }): SlotNotice {
    const note = (input.note ?? '').trim();
    if (note.length < 3 || note.length > 500) {
      throw new InvalidValueException('O recado deve ter entre 3 e 500 caracteres.');
    }

    return new SlotNotice(
      SlotNoticeId.create(),
      input.accountId,
      input.createdByUserId,
      note,
      'open',
      null,
      null,
      new Date(),
    );
  }

  static restore(input: {
    id: SlotNoticeId;
    accountId: AccountId;
    createdByUserId: UserId;
    note: string;
    status: SlotNoticeStatus;
    handledByUserId: UserId | null;
    handledAt: Date | null;
    createdAt: Date;
  }): SlotNotice {
    return new SlotNotice(
      input.id,
      input.accountId,
      input.createdByUserId,
      input.note,
      input.status,
      input.handledByUserId,
      input.handledAt,
      input.createdAt,
    );
  }

  /** O Administrativo viu e resolveu. Idempotente: marcar duas vezes não é erro de negócio. */
  markHandled(byUserId: UserId, at: Date = new Date()): void {
    this._status = 'handled';
    this._handledByUserId = byUserId;
    this._handledAt = at;
  }

  get id(): SlotNoticeId {
    return this._id;
  }

  get accountId(): AccountId {
    return this._accountId;
  }

  get createdByUserId(): UserId {
    return this._createdByUserId;
  }

  get note(): string {
    return this._note;
  }

  get status(): SlotNoticeStatus {
    return this._status;
  }

  get handledByUserId(): UserId | null {
    return this._handledByUserId;
  }

  get handledAt(): Date | null {
    return this._handledAt;
  }

  get createdAt(): Date {
    return this._createdAt;
  }
}
