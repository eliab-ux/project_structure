import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { Email } from '../../../../user/domain/value-objects/email.vo';
import { InvalidCredentialsException } from '../../../../user/domain/exceptions/invalid-credentials.exception';
import {
  AuditAction,
  AuditActorType,
} from '../../../../audit/domain/value-objects/audit-action.vo';
import { RecordAuditLogUseCase } from '../../../../audit/application/use-cases/record-audit-log.use-case';
import {
  PASSWORD_HASHER,
  PasswordHasherPort,
} from '../../../../auth/application/ports/output/password-hasher.port';
import {
  TOKEN_SERVICE,
  TokenServicePort,
} from '../../../../auth/application/ports/output/token-service.port';
import { PlatformAuthResultDto } from '../../../../auth/application/dto/auth-result.dto';
import {
  PLATFORM_ADMIN_REPOSITORY,
  PlatformAdminRepositoryPort,
} from '../../ports/output/platform-admin-repository.port';
import { PlatformLoginCommand } from './platform-login.command';

/**
 * Platform login — a separate flow from tenant login, over a separate table, issuing a token with
 * a separate shape (`scope: 'PLATFORM'`, no `accountId`). A platform token is therefore never
 * accepted by a tenant guard, and vice versa.
 */
@Injectable()
export class PlatformLoginUseCase implements UseCase<PlatformLoginCommand, PlatformAuthResultDto> {
  private readonly logger = new Logger(PlatformLoginUseCase.name);

  constructor(
    @Inject(PLATFORM_ADMIN_REPOSITORY) private readonly admins: PlatformAdminRepositoryPort,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasherPort,
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenServicePort,
    private readonly audit: RecordAuditLogUseCase,
  ) {}

  async execute(command: PlatformLoginCommand): Promise<PlatformAuthResultDto> {
    const admin = await this.admins.findByEmail(Email.create(command.email));

    if (!admin) {
      this.logger.warn('Falha na autenticação de plataforma', { reason: 'unknown_email' });
      throw new InvalidCredentialsException();
    }

    const matches = await this.hasher.compare(command.password, admin.passwordHashForPersistence());
    if (!matches || !admin.active) {
      this.logger.warn('Falha na autenticação de plataforma', {
        adminId: admin.id.value,
        reason: matches ? 'inactive' : 'invalid_password',
      });
      throw new InvalidCredentialsException();
    }

    admin.registerSuccessfulLogin();
    await this.admins.save(admin);

    const issued = this.tokens.issueForPlatformAdmin({ sub: admin.id.value, scope: 'PLATFORM' });

    await this.audit.execute({
      // Platform-level action: it belongs to no tenant, which is why audit_logs.account_id is nullable.
      accountId: null,
      actorType: AuditActorType.PLATFORM_ADMIN,
      actorId: admin.id.value,
      action: AuditAction.PLATFORM_ADMIN_LOGIN,
      entityType: 'platform_admin',
      entityId: admin.id.value,
      ip: command.ip,
    });

    const result = new PlatformAuthResultDto();
    result.accessToken = issued.accessToken;
    result.refreshToken = issued.refreshToken;
    result.expiresIn = issued.expiresIn;
    result.admin = { id: admin.id.value, name: admin.name, email: admin.email.value };
    return result;
  }
}
