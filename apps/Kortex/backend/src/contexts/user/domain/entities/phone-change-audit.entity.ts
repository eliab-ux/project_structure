import { AggregateRoot } from '@gitspread/domain-primitives';
import { PhoneE164 } from '../../../../shared/domain/value-objects/phone-e164.vo';
import { AccountId } from '../../../account/domain/value-objects/account-id.vo';
import { UserId } from '../value-objects/user-id.vo';
import { PhoneChangeAuditId } from '../value-objects/phone-change-audit-id.vo';

/**
 * Trilha de uma troca de telefone **de terceiro** (spec §6.12).
 *
 * Existe porque alterar o telefone de outro usuário equivale a tomar a conta dele: é para esse
 * número que vai o código de recuperação de senha. A ação é exclusiva do `owner`, e esta linha é o
 * que permite reconstruir um sequestro depois do fato.
 *
 * Guarda o número ANTIGO porque é justamente ele que some do `app_user` no momento do update —
 * sem ele a trilha registraria que algo mudou sem dizer o quê.
 *
 * A troca do PRÓPRIO telefone não gera auditoria: não há terceiro, não há o que reconstruir.
 */
export class PhoneChangeAudit extends AggregateRoot {
  private constructor(
    private readonly _id: PhoneChangeAuditId,
    private readonly _accountId: AccountId,
    private readonly _userId: UserId,
    private readonly _changedByUserId: UserId,
    private readonly _previousPhone: PhoneE164,
    private readonly _newPhone: PhoneE164,
    private readonly _createdAt: Date,
  ) {
    super();
  }

  static record(input: {
    accountId: AccountId;
    userId: UserId;
    changedByUserId: UserId;
    previousPhone: PhoneE164;
    newPhone: PhoneE164;
  }): PhoneChangeAudit {
    return new PhoneChangeAudit(
      PhoneChangeAuditId.create(),
      input.accountId,
      input.userId,
      input.changedByUserId,
      input.previousPhone,
      input.newPhone,
      new Date(),
    );
  }

  static restore(input: {
    id: PhoneChangeAuditId;
    accountId: AccountId;
    userId: UserId;
    changedByUserId: UserId;
    previousPhone: PhoneE164;
    newPhone: PhoneE164;
    createdAt: Date;
  }): PhoneChangeAudit {
    return new PhoneChangeAudit(
      input.id,
      input.accountId,
      input.userId,
      input.changedByUserId,
      input.previousPhone,
      input.newPhone,
      input.createdAt,
    );
  }

  get id(): PhoneChangeAuditId {
    return this._id;
  }

  get accountId(): AccountId {
    return this._accountId;
  }

  get userId(): UserId {
    return this._userId;
  }

  get changedByUserId(): UserId {
    return this._changedByUserId;
  }

  get previousPhone(): PhoneE164 {
    return this._previousPhone;
  }

  get newPhone(): PhoneE164 {
    return this._newPhone;
  }

  get createdAt(): Date {
    return this._createdAt;
  }
}
