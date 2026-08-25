import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { PhoneE164 } from '../../../../../shared/domain/value-objects/phone-e164.vo';
import {
  ACCOUNT_REPOSITORY,
  AccountRepositoryPort,
} from '../../../../account/application/ports/output/account-repository.port';
import { AccountDto } from '../../../../account/application/dto/account.dto';
import { Account } from '../../../../account/domain/entities/account.entity';
import { AccountPlan } from '../../../../account/domain/value-objects/account-plan.vo';
import { AccountStatus } from '../../../../account/domain/value-objects/account-status.vo';
import { Document } from '../../../../account/domain/value-objects/document.vo';
import {
  USER_REPOSITORY,
  UserRepositoryPort,
} from '../../../../user/application/ports/output/user-repository.port';
import { User } from '../../../../user/domain/entities/user.entity';
import { Email } from '../../../../user/domain/value-objects/email.vo';
import { UserRole } from '../../../../user/domain/value-objects/user-role.vo';
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
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import { AccountAlreadyExistsException } from '../../../domain/exceptions/account-already-exists.exception';
import { CreateAccountCommand } from './create-account.command';

/**
 * Creates a tenant and its first ACCOUNT_ADMIN, in one transaction — a tenant nobody can log into
 * is not a tenant. Platform-only operation.
 *
 * The plan does not derive the ceiling: the ceiling is given explicitly, because the plan
 * catalogue is DECISÃO PENDENTE (§14, item 8) and inventing a number here would bake a guess
 * into every account created from now on.
 */
@Injectable()
export class CreateAccountUseCase implements UseCase<CreateAccountCommand, AccountDto> {
  private readonly logger = new Logger(CreateAccountUseCase.name);

  constructor(
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepositoryPort,
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasherPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWorkPort,
    private readonly audit: RecordAuditLogUseCase,
  ) {}

  async execute(command: CreateAccountCommand): Promise<AccountDto> {
    const document = Document.create(command.document);
    const adminEmail = Email.create(command.adminEmail);
    // Validated before anything is written: an account whose only admin has no reachable WhatsApp
    // is an account that dies at the first forgotten password.
    const adminPhone = PhoneE164.create(command.adminPhone);
    assertStrongPassword(command.adminPassword);

    if (await this.accounts.existsByDocument(document.value)) {
      throw new AccountAlreadyExistsException();
    }

    const passwordHash = await this.hasher.hash(command.adminPassword);

    return this.unitOfWork.execute(async () => {
      const account = Account.create({
        name: command.name,
        document,
        plan: this.parsePlan(command.plan),
        dailySendCeiling: command.dailySendCeiling,
        timezone: command.timezone,
        status: AccountStatus.TRIAL,
      });

      const saved = await this.accounts.save(account);

      const admin = User.create({
        accountId: saved.id.value,
        name: command.adminName,
        email: adminEmail,
        phone: adminPhone,
        passwordHash,
        role: UserRole.ACCOUNT_ADMIN,
      });
      await this.users.save(admin);

      await this.audit.execute({
        accountId: saved.id.value,
        actorType: AuditActorType.PLATFORM_ADMIN,
        actorId: command.performedBy,
        action: AuditAction.ACCOUNT_CREATED,
        entityType: 'account',
        entityId: saved.id.value,
        ip: command.ip,
        // No document, no password: the trail records that it happened, not the secrets.
        payload: { plan: saved.plan, dailySendCeiling: saved.dailySendCeiling },
      });
      await this.audit.execute({
        accountId: saved.id.value,
        actorType: AuditActorType.PLATFORM_ADMIN,
        actorId: command.performedBy,
        action: AuditAction.USER_CREATED,
        entityType: 'user',
        entityId: admin.id.value,
        ip: command.ip,
        payload: { role: admin.role },
      });

      this.logger.log('Conta criada', { accountId: saved.id.value });
      return AccountDto.fromDomain(saved);
    });
  }

  private parsePlan(plan: string): AccountPlan {
    const normalized = (plan ?? '').toUpperCase();
    return Object.values(AccountPlan).includes(normalized as AccountPlan)
      ? (normalized as AccountPlan)
      : AccountPlan.TRIAL;
  }
}
