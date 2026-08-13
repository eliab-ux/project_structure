import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@veertex/shared-kernel';
import { Email } from '../../../../../shared/domain/value-objects/email.vo';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import {
  USER_REPOSITORY,
  UserRepositoryPort,
} from '../../../../user/application/ports/output/user-repository.port';
import { assertPasswordStrength } from '../../../domain/password-policy';
import { InvalidResetCodeException } from '../../../domain/exceptions/auth-exceptions';
import { PASSWORD_HASHER, PasswordHasherPort } from '../../ports/output/password-hasher.port';
import {
  PASSWORD_RESET_CODE_REPOSITORY,
  PasswordResetCodeRepositoryPort,
} from '../../ports/output/password-reset-code-repository.port';
import { TENANT_SCOPE, TenantScopePort } from '../../ports/output/tenant-scope.port';

export class ResetPasswordCommand {
  constructor(
    public readonly email: string,
    public readonly code: string,
    public readonly newPassword: string,
    public readonly ip: string | null,
  ) {}
}

/**
 * Consumes a WhatsApp code and sets a new password.
 *
 * Every failure raises the SAME exception: unknown e-mail, no live code, wrong code, expired code,
 * already used, attempts exhausted. Distinguishing them would confirm which addresses have an
 * account and which codes are still alive.
 *
 * The attempt is counted and PERSISTED BEFORE the comparison. Counting afterwards would make the
 * five-attempt limit unenforceable — an attacker only needs the try that succeeds, and a process
 * killed mid-request would forget the failures.
 */
@Injectable()
export class ResetPasswordUseCase implements UseCase<ResetPasswordCommand, void> {
  private readonly logger = new Logger(ResetPasswordUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(PASSWORD_RESET_CODE_REPOSITORY)
    private readonly codes: PasswordResetCodeRepositoryPort,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasherPort,
    @Inject(TENANT_SCOPE) private readonly tenantScope: TenantScopePort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: ResetPasswordCommand): Promise<void> {
    // Validated before anything else: a weak password would be rejected after the code was already
    // burned, forcing the user to request a second one for a mistake they can fix immediately.
    assertPasswordStrength(command.newPassword);

    const found = await this.users.findForAuthentication(Email.create(command.email));
    if (!found || !found.user.isActive) {
      throw new InvalidResetCodeException();
    }

    await this.tenantScope.establishFromAuthenticatedUser(found.accountId);

    const { user } = found;
    const now = new Date();
    const live = await this.codes.findLiveByUser(user.id.value, now);

    if (!live || !live.isUsable(now)) {
      this.logger.warn('Tentativa de reset sem código válido', { userId: user.id.value });
      throw new InvalidResetCodeException();
    }

    // Contada ANTES da comparação, e numa transação própria: esta requisição termina em exceção
    // quando o palpite erra, e a exceção derruba a transação em curso. Um contador gravado dentro
    // dela seria desfeito — era o que acontecia, e deixava o limite de cinco tentativas valendo
    // nada contra força bruta num código de seis dígitos.
    live.syncAttempts(await this.codes.registerFailedAttempt(live.id));

    const matches = await this.hasher.compare(command.code, live.codeHash);
    if (!matches) {
      // The code itself is NEVER logged — not even on failure (CLAUDE.md).
      this.logger.warn('Código de recuperação incorreto', {
        userId: user.id.value,
        attempts: live.attempts,
        ip: command.ip,
      });
      throw new InvalidResetCodeException();
    }

    user.changePasswordHash(await this.hasher.hash(command.newPassword));
    live.consume(now);

    await this.uow.execute(async () => {
      await this.users.save(user);
      await this.codes.save(live);
    });

    this.logger.log('Senha redefinida por código de WhatsApp', { userId: user.id.value });
  }
}
