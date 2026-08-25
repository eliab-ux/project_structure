import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  USER_REPOSITORY,
  UserRepositoryPort,
} from '../../../../user/application/ports/output/user-repository.port';
import { Email } from '../../../../user/domain/value-objects/email.vo';
import {
  AuditAction,
  AuditActorType,
} from '../../../../audit/domain/value-objects/audit-action.vo';
import { RecordAuditLogUseCase } from '../../../../audit/application/use-cases/record-audit-log.use-case';
import { InvalidResetCodeException } from '../../../domain/exceptions/invalid-reset-code.exception';
import { assertStrongPassword } from '../../../domain/password-policy';
import { PASSWORD_HASHER, PasswordHasherPort } from '../../ports/output/password-hasher.port';
import {
  PASSWORD_RESET_CODE_REPOSITORY,
  PasswordResetCodeRepositoryPort,
} from '../../ports/output/password-reset-code-repository.port';
import { ResetPasswordCommand } from './reset-password.command';

/**
 * Changes the password using the code received on WhatsApp.
 *
 * Every refusal raises the SAME exception (`InvalidResetCodeException`), and every wrong guess is
 * counted on the code itself — that is what turns 1,000,000 combinations into five chances.
 *
 * The whole flow is anonymous: there is no JWT on a "forgot my password" request. The `accountId`
 * used for the audit entry is read from the stored code, never from the request.
 */
@Injectable()
export class ResetPasswordUseCase implements UseCase<ResetPasswordCommand, void> {
  private readonly logger = new Logger(ResetPasswordUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(PASSWORD_RESET_CODE_REPOSITORY)
    private readonly codes: PasswordResetCodeRepositoryPort,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasherPort,
    private readonly audit: RecordAuditLogUseCase,
  ) {}

  async execute(command: ResetPasswordCommand): Promise<void> {
    // Checked before anything else: a weak new password is the caller's own mistake, not a hint
    // about whether the code was right, so failing here leaks nothing.
    assertStrongPassword(command.newPassword);

    const user = await this.users.findByEmailForAuthentication(Email.create(command.email));
    if (!user || !user.isActive) {
      throw new InvalidResetCodeException();
    }

    const code = await this.codes.findLatestUnused(user.id.value);
    if (!code || !code.isUsable()) {
      this.logger.warn('Código ausente, expirado ou sem tentativas', { userId: user.id.value });
      throw new InvalidResetCodeException();
    }

    if (!(await this.hasher.compare(command.code, code.codeHash))) {
      // The attempt is counted BEFORE refusing. Without this, the code would accept guesses forever.
      code.registerFailedAttempt();
      await this.codes.save(code);
      this.logger.warn('Código de recuperação incorreto', {
        userId: user.id.value,
        attempts: code.attempts,
      });
      throw new InvalidResetCodeException();
    }

    code.markUsed();
    await this.codes.save(code);

    user.changePasswordHash(await this.hasher.hash(command.newPassword));
    await this.users.save(user);

    // Any other live code dies with it — including one from a duplicate request.
    await this.codes.invalidateAllForUser(user.id.value, new Date());

    await this.audit.execute({
      accountId: code.accountId,
      actorType: AuditActorType.USER,
      actorId: user.id.value,
      action: AuditAction.PASSWORD_RESET_COMPLETED,
      entityType: 'user',
      entityId: user.id.value,
      ip: command.ip,
    });

    // Known and accepted limitation: refresh tokens already issued stay valid until they expire,
    // because they are JWTs with no revocation list. Changing the password does not close sessions
    // open on other devices. Fixing it requires storing refresh tokens.
    this.logger.log('Senha redefinida', { userId: user.id.value });
  }
}
