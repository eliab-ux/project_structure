import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  USER_REPOSITORY,
  UserRepositoryPort,
} from '../../../../user/application/ports/output/user-repository.port';
import {
  PASSWORD_HASHER,
  PasswordHasherPort,
} from '../../../../user/application/ports/output/password-hasher.port';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import { InvalidCredentialsException } from '../../../domain/exceptions/invalid-credentials.exception';
import { AccountId } from '../../../../account/domain/value-objects/account-id.vo';
import { UserId } from '../../../../user/domain/value-objects/user-id.vo';
import { PlainPassword } from '../../../../../shared/domain/value-objects/plain-password.vo';

export class ChangePasswordCommand {
  constructor(
    public readonly accountId: string,
    public readonly userId: string,
    public readonly currentPassword: PlainPassword,
    public readonly newPassword: PlainPassword,
  ) {}
}

/**
 * Troca de senha pelo próprio usuário — inclusive a obrigatória do primeiro login.
 *
 * A senha atual é exigida mesmo com o usuário já autenticado: um token vale 15 minutos e uma
 * estação destravada vale menos que isso. Sem a senha atual, quem passa pela mesa de alguém
 * assume a conta permanentemente em dois cliques.
 */
@Injectable()
export class ChangePasswordUseCase implements UseCase<ChangePasswordCommand, void> {
  private readonly logger = new Logger(ChangePasswordUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasherPort,
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(command: ChangePasswordCommand): Promise<void> {
    const user = await this.userRepository.findById(
      AccountId.from(command.accountId),
      UserId.from(command.userId),
    );
    if (!user || !user.canAuthenticate()) {
      throw new InvalidCredentialsException();
    }

    const matches = await command.currentPassword.use((plain) =>
      this.passwordHasher.compare(plain, user.passwordHash),
    );
    if (!matches) {
      this.logger.warn('Troca de senha recusada', {
        userId: user.id.value,
        reason: 'invalid_current_password',
      });
      throw new InvalidCredentialsException();
    }

    const newHash = await command.newPassword.use((plain) => this.passwordHasher.hash(plain));
    user.changePassword(newHash);

    await this.unitOfWork.execute(async () => {
      await this.userRepository.save(user);
    });

    this.logger.log('Senha alterada pelo próprio usuário', { userId: user.id.value });
  }
}
