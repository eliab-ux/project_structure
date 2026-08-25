import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { PhoneE164 } from '../../../../../shared/domain/value-objects/phone-e164.vo';
import {
  AuditAction,
  AuditActorType,
} from '../../../../audit/domain/value-objects/audit-action.vo';
import { RecordAuditLogUseCase } from '../../../../audit/application/use-cases/record-audit-log.use-case';
import {
  PASSWORD_HASHER,
  PasswordHasherPort,
} from '../../../../auth/application/ports/output/password-hasher.port';
import { assertStrongPassword } from '../../../../auth/domain/password-policy';
import { User } from '../../../domain/entities/user.entity';
import { Email } from '../../../domain/value-objects/email.vo';
import { UserAlreadyExistsException } from '../../../domain/exceptions/user-already-exists.exception';
import { UserDto } from '../../dto/user.dto';
import { USER_REPOSITORY, UserRepositoryPort } from '../../ports/output/user-repository.port';
import { CreateUserCommand } from './create-user.command';

/**
 * An ACCOUNT_ADMIN adds a user to its OWN account. The `accountId` comes from the token, so there
 * is no request shape that can create a user inside another tenant.
 */
@Injectable()
export class CreateUserUseCase implements UseCase<CreateUserCommand, UserDto> {
  private readonly logger = new Logger(CreateUserUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasherPort,
    private readonly audit: RecordAuditLogUseCase,
  ) {}

  async execute(command: CreateUserCommand): Promise<UserDto> {
    const email = Email.create(command.email);
    assertStrongPassword(command.password);

    // Tenant-scoped: the same e-mail may exist in another account, which is why the unique index
    // is (account_id, email) and not (email).
    const existing = await this.users.findByEmail(email);
    if (existing) {
      throw new UserAlreadyExistsException();
    }

    const user = User.create({
      accountId: command.accountId,
      name: command.name,
      email,
      // Throws InvalidPhoneNumberException on anything that is not a usable number — a user has to
      // be reachable on WhatsApp or they cannot recover the password (CLAUDE.md regra 9).
      phone: PhoneE164.create(command.phone),
      passwordHash: await this.hasher.hash(command.password),
      role: command.role,
    });

    const saved = await this.users.save(user);

    await this.audit.execute({
      accountId: command.accountId,
      actorType: AuditActorType.USER,
      actorId: command.performedBy,
      action: AuditAction.USER_CREATED,
      entityType: 'user',
      entityId: saved.id.value,
      ip: command.ip,
      payload: { role: saved.role },
    });

    this.logger.log('Usuário criado', { userId: saved.id.value, accountId: command.accountId });
    return UserDto.fromDomain(saved);
  }
}
