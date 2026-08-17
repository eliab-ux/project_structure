import { AggregateRoot } from '@gitspread/domain-primitives';
import { InvalidValueException } from '../../../../shared/domain/exceptions/invalid-value.exception';
import { Email } from '../../../../shared/domain/value-objects/email.vo';
import { PhoneE164 } from '../../../../shared/domain/value-objects/phone-e164.vo';
import { AccountId } from '../../../account/domain/value-objects/account-id.vo';
import { UserId } from '../value-objects/user-id.vo';
import { UserRole, assertUserRole } from '../value-objects/user-role.vo';

/**
 * Um usuário do sistema — e, por definição, um membro da equipe: **não existe pessoa sem login**
 * (spec §4.3). Toda autoria (quem registrou o pagamento, quem apontou a matriz) referencia este
 * id, e é por isso que desligar é `deactivate()` e nunca exclusão: apagar a linha quebraria a
 * autoria de todo o histórico.
 *
 * O telefone é obrigatório e é `PhoneE164`, não string (regra 9 do CLAUDE.md): é por ele que
 * chega o código de recuperação de senha.
 *
 * A entidade nunca vê senha em claro. Quem transforma senha em hash é o adapter de infraestrutura
 * (`PasswordHasherPort`) — o domínio não conhece bcrypt, nem deve.
 */
export class User extends AggregateRoot {
  private constructor(
    private readonly _id: UserId,
    private readonly _accountId: AccountId,
    private _name: string,
    private _email: Email,
    private _phone: PhoneE164,
    private _passwordHash: string,
    private _role: UserRole,
    private _isActive: boolean,
    private _mustChangePassword: boolean,
    private _lastLoginAt: Date | null,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
  ) {
    super();
  }

  static create(input: {
    accountId: AccountId;
    name: string;
    email: Email;
    phone: PhoneE164;
    passwordHash: string;
    role: UserRole;
    /**
     * `false` só no bootstrap da conta, onde o dono escolhe a própria senha. Todo usuário criado
     * pelo Administrativo nasce com senha provisória e troca no primeiro login (spec §4.3) — quem
     * digitou a senha do outro conhece a senha do outro.
     */
    mustChangePassword?: boolean;
  }): User {
    const now = new Date();
    return new User(
      UserId.create(),
      input.accountId,
      User.assertName(input.name),
      input.email,
      input.phone,
      User.assertPasswordHash(input.passwordHash),
      assertUserRole(input.role),
      true,
      input.mustChangePassword ?? true,
      null,
      now,
      now,
    );
  }

  static restore(input: {
    id: UserId;
    accountId: AccountId;
    name: string;
    email: Email;
    phone: PhoneE164;
    passwordHash: string;
    role: UserRole;
    isActive: boolean;
    mustChangePassword: boolean;
    lastLoginAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): User {
    return new User(
      input.id,
      input.accountId,
      input.name,
      input.email,
      input.phone,
      input.passwordHash,
      input.role,
      input.isActive,
      input.mustChangePassword,
      input.lastLoginAt,
      input.createdAt,
      input.updatedAt,
    );
  }

  changeProfile(input: { name: string; email: Email; phone: PhoneE164 }): void {
    this._name = User.assertName(input.name);
    this._email = input.email;
    this._phone = input.phone;
    this.touch();
  }

  changeRole(role: UserRole): void {
    this._role = assertUserRole(role);
    this.touch();
  }

  /**
   * Troca feita pelo PRÓPRIO usuário — seja no primeiro login, seja pelo código recebido no
   * WhatsApp. Nos dois casos quem escolheu a senha foi ele e mais ninguém a conhece, então a
   * obrigação de trocar se encerra aqui.
   *
   * Não existe método para o Administrativo redefinir a senha de outra pessoa: a recuperação é
   * self-service pelo WhatsApp (regra 9 do CLAUDE.md), e uma senha escolhida por terceiro é uma
   * senha que duas pessoas conhecem.
   */
  changePassword(passwordHash: string): void {
    this._passwordHash = User.assertPasswordHash(passwordHash);
    this._mustChangePassword = false;
    this.touch();
  }

  registerLogin(at: Date = new Date()): void {
    this._lastLoginAt = at;
    this.touch();
  }

  activate(): void {
    this._isActive = true;
    this.touch();
  }

  deactivate(): void {
    this._isActive = false;
    this.touch();
  }

  /** Só usuário ativo autentica — desligar alguém encerra o acesso na hora. */
  canAuthenticate(): boolean {
    return this._isActive;
  }

  private touch(): void {
    this._updatedAt = new Date();
  }

  private static assertName(name: string): string {
    const value = (name ?? '').trim();
    if (value.length < 2 || value.length > 200) {
      throw new InvalidValueException('Nome deve ter entre 2 e 200 caracteres.');
    }
    return value;
  }

  private static assertPasswordHash(hash: string): string {
    // Guarda contra o pior bug possível aqui: alguém passar a senha em claro no lugar do hash.
    // Um hash bcrypt tem 60 caracteres e começa com $2; uma senha digitada, não.
    if (!hash || hash.length < 20 || !hash.startsWith('$2')) {
      throw new InvalidValueException('Hash de senha inválido.');
    }
    return hash;
  }

  get id(): UserId {
    return this._id;
  }

  get accountId(): AccountId {
    return this._accountId;
  }

  get name(): string {
    return this._name;
  }

  get email(): Email {
    return this._email;
  }

  get phone(): PhoneE164 {
    return this._phone;
  }

  /**
   * Exposto porque o caso de uso de login precisa comparar o hash pelo adapter. **Nunca** vai para
   * DTO de resposta nem para log — ver `UserDto`, que não o mapeia.
   */
  get passwordHash(): string {
    return this._passwordHash;
  }

  get role(): UserRole {
    return this._role;
  }

  get isActive(): boolean {
    return this._isActive;
  }

  get mustChangePassword(): boolean {
    return this._mustChangePassword;
  }

  get lastLoginAt(): Date | null {
    return this._lastLoginAt;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }
}
