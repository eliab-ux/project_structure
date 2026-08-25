import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { DomainException } from '@gitspread/domain-primitives';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import {
  PASSWORD_HASHER,
  PasswordHasherPort,
} from '../../../../../infrastructure/security/ports/password-hasher.port';
import {
  USER_REPOSITORY,
  UserRepositoryPort,
} from '../../../../user/application/ports/output/user-repository.port';

class InvalidResetTokenException extends DomainException {
  constructor() {
    super('Invalid or expired reset token');
  }
}

export class ResetPasswordCommand {
  constructor(
    public readonly token: string,
    public readonly newPassword: string,
  ) {}
}

@Injectable()
export class ResetPasswordUseCase implements UseCase<ResetPasswordCommand, void> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepositoryPort,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasherPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: ResetPasswordCommand): Promise<void> {
    const user = await this.userRepository.findByResetToken(command.token);
    if (!user || !user.isResetTokenValid(command.token)) {
      throw new InvalidResetTokenException();
    }

    const passwordHash = await this.passwordHasher.hash(command.newPassword);
    user.changePassword(passwordHash);

    await this.uow.execute(async () => {
      await this.userRepository.save(user);
    });
  }
}
