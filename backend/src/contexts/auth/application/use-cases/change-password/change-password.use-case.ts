import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import {
  USER_REPOSITORY,
  UserRepositoryPort,
} from '../../../../user/application/ports/output/user-repository.port';
import { UserId } from '../../../../user/domain/value-objects/user-id.vo';
import {
  InvalidCredentialsException,
  UserNotFoundException,
} from '../../../../user/domain/exceptions/user-exceptions';
import { assertPasswordStrength } from '../../../domain/password-policy';
import { PASSWORD_HASHER, PasswordHasherPort } from '../../ports/output/password-hasher.port';

export class ChangePasswordCommand {
  constructor(
    /** From the token — a user can only ever change their own password here. */
    public readonly userId: string,
    public readonly currentPassword: string,
    public readonly newPassword: string,
  ) {}
}

/**
 * A logged-in user changing their own password.
 *
 * The current password is required even though the caller is authenticated: an access token left
 * open on a shared machine would otherwise be enough to take the account over permanently. Proving
 * knowledge of the password is what stops a borrowed session from becoming ownership.
 */
@Injectable()
export class ChangePasswordUseCase implements UseCase<ChangePasswordCommand, void> {
  private readonly logger = new Logger(ChangePasswordUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasherPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: ChangePasswordCommand): Promise<void> {
    assertPasswordStrength(command.newPassword);

    const user = await this.users.findById(UserId.from(command.userId));
    if (!user) {
      throw new UserNotFoundException();
    }

    const matches = await this.hasher.compare(
      command.currentPassword,
      user.passwordHashForPersistence(),
    );
    if (!matches) {
      this.logger.warn('Troca de senha recusada', {
        userId: user.id.value,
        reason: 'invalid_current_password',
      });
      throw new InvalidCredentialsException();
    }

    user.changePasswordHash(await this.hasher.hash(command.newPassword));

    await this.uow.execute(async () => {
      await this.users.save(user);
    });

    this.logger.log('Senha alterada pelo próprio usuário', { userId: user.id.value });
  }
}
