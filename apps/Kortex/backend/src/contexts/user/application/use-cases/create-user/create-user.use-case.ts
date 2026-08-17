import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { USER_REPOSITORY, UserRepositoryPort } from '../../ports/output/user-repository.port';
import { PASSWORD_HASHER, PasswordHasherPort } from '../../ports/output/password-hasher.port';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import { UserDto } from '../../dto/user.dto';
import { User } from '../../../domain/entities/user.entity';
import { UserRole, assertUserRole } from '../../../domain/value-objects/user-role.vo';
import { EmailAlreadyInUseException } from '../../../domain/exceptions/email-already-in-use.exception';
import { ForbiddenRoleAssignmentException } from '../../../domain/exceptions/forbidden-role-assignment.exception';
import { AccountId } from '../../../../account/domain/value-objects/account-id.vo';
import { Email } from '../../../../../shared/domain/value-objects/email.vo';
import { PhoneE164 } from '../../../../../shared/domain/value-objects/phone-e164.vo';
import { PlainPassword } from '../../../../../shared/domain/value-objects/plain-password.vo';

export class CreateUserCommand {
  constructor(
    public readonly accountId: string,
    /** Papel de quem está criando — vem do JWT, nunca do corpo da requisição. */
    public readonly actorRole: UserRole,
    public readonly name: string,
    public readonly email: string,
    public readonly phone: string,
    public readonly role: string,
    public readonly initialPassword: PlainPassword,
  ) {}
}

@Injectable()
export class CreateUserUseCase implements UseCase<CreateUserCommand, UserDto> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasherPort,
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(command: CreateUserCommand): Promise<UserDto> {
    const role = assertUserRole(command.role);

    // Autorização contextual, além do guard da rota: o `AdminGuard` deixa o `admin` chegar até
    // aqui, e é aqui que se decide que ele não pode fabricar um `owner` (spec §5). Sem isto, um
    // admin se promoveria criando um dono e entrando com ele.
    if (role === 'owner' && command.actorRole !== 'owner') {
      throw new ForbiddenRoleAssignmentException();
    }

    const email = Email.create(command.email);

    // A consulta é global porque o índice único é global. Buscar dentro da conta deixaria o insert
    // estourar com erro de constraint — 500 e mensagem de banco no lugar de um 400 explicado.
    const existing = await this.userRepository.findByEmailGlobally(email);
    if (existing) {
      throw new EmailAlreadyInUseException();
    }

    const passwordHash = await command.initialPassword.use((plain) =>
      this.passwordHasher.hash(plain),
    );

    const user = User.create({
      accountId: AccountId.from(command.accountId),
      name: command.name,
      email,
      phone: PhoneE164.create(command.phone),
      passwordHash,
      role,
      // Quem digitou a senha foi o Administrativo, então ela é conhecida por duas pessoas até a
      // primeira troca. O protótipo diz isso na própria tela: "você cria o acesso; ele troca a
      // senha no primeiro login".
      mustChangePassword: true,
    });

    return this.unitOfWork.execute(async () => {
      const saved = await this.userRepository.save(user);
      return UserDto.fromDomain(saved);
    });
  }
}
