import { AggregateRoot } from '@gitspread/domain-primitives';
import { UserRegisteredEvent } from '../events/user-registered.event';
import { InvalidUserNameException } from '../exceptions/invalid-user-name.exception';
import { Email } from '../value-objects/email.vo';
import { PhoneNumber } from '../value-objects/phone-number.vo';
import { UserId } from '../value-objects/user-id.vo';
import { UserRole } from '../value-objects/user-role.vo';

const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 120;

/**
 * O dono da conta. Cada usuário tem seu próprio WhatsApp conectado, seu agendamento e seu
 * histórico de envios — `id` é a chave de tenancy de todo dado do sistema.
 *
 * O hash da senha vive dentro do agregado mas nunca sai por HTTP: quem monta a resposta é o
 * UserDto/UserResponseDto, que não mapeia esse campo.
 */
export class User extends AggregateRoot {
  private constructor(
    private readonly _id: UserId,
    private _email: Email,
    private _name: string,
    private _passwordHash: string,
    private _phone: PhoneNumber | null,
    private _role: UserRole,
    private _isActive: boolean,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
  ) {
    super();
  }

  /** O WhatsApp é exigido no cadastro: é por ele que a recuperação de senha fala com o dono. */
  static register(email: Email, name: string, passwordHash: string, phone: PhoneNumber): User {
    const now = new Date();
    const user = new User(
      UserId.generate(),
      email,
      User.ensureValidName(name),
      passwordHash,
      phone,
      UserRole.USER,
      true,
      now,
      now,
    );
    user.addDomainEvent(new UserRegisteredEvent(user._id.value, email.value, user._name));
    return user;
  }

  /**
   * `phone` é anulável **só aqui**, na volta do banco: contas criadas antes do campo existir não
   * têm número, e inventar um seria pior do que admitir a ausência. Quem depende do número
   * (recuperação de senha) trata o `null` explicitamente.
   */
  static reconstitute(
    id: UserId,
    email: Email,
    name: string,
    passwordHash: string,
    phone: PhoneNumber | null,
    role: UserRole,
    isActive: boolean,
    createdAt: Date,
    updatedAt: Date,
  ): User {
    return new User(id, email, name, passwordHash, phone, role, isActive, createdAt, updatedAt);
  }

  changeName(name: string): void {
    this._name = User.ensureValidName(name);
    this._updatedAt = new Date();
  }

  changePhone(phone: PhoneNumber): void {
    this._phone = phone;
    this._updatedAt = new Date();
  }

  changePassword(newPasswordHash: string): void {
    this._passwordHash = newPasswordHash;
    this._updatedAt = new Date();
  }

  deactivate(): void {
    this._isActive = false;
    this._updatedAt = new Date();
  }

  /** Só uma conta ativa pode autenticar — desativar é o kill switch da conta. */
  get canAuthenticate(): boolean {
    return this._isActive;
  }

  private static ensureValidName(name: string): string {
    const trimmed = (name ?? '').trim();
    if (trimmed.length < NAME_MIN_LENGTH || trimmed.length > NAME_MAX_LENGTH) {
      throw new InvalidUserNameException(NAME_MIN_LENGTH, NAME_MAX_LENGTH);
    }
    return trimmed;
  }

  get id(): UserId {
    return this._id;
  }
  get email(): Email {
    return this._email;
  }
  get name(): string {
    return this._name;
  }
  get passwordHash(): string {
    return this._passwordHash;
  }
  get phone(): PhoneNumber | null {
    return this._phone;
  }
  get role(): UserRole {
    return this._role;
  }
  get isActive(): boolean {
    return this._isActive;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }
}
