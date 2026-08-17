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
  PASSWORD_RESET_CODE_REPOSITORY,
  PasswordResetCodeRepositoryPort,
} from '../../ports/output/password-reset-code-repository.port';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import { PasswordResetUnavailableException } from '../../../domain/exceptions/password-reset-unavailable.exception';
import { Email } from '../../../../../shared/domain/value-objects/email.vo';
import { PlainPassword } from '../../../../../shared/domain/value-objects/plain-password.vo';

export class ResetPasswordCommand {
  constructor(
    public readonly email: string,
    public readonly code: string,
    public readonly newPassword: PlainPassword,
  ) {}
}

/**
 * Redefine a senha com o código recebido no WhatsApp.
 *
 * Toda recusa levanta a MESMA exceção, com a MESMA mensagem: código inexistente, expirado, já
 * usado, tentativas esgotadas, código errado, e-mail que não existe. Distinguir qualquer um deles
 * seria um oráculo — "código expirado" confirma que houve um pedido para aquele e-mail.
 */
@Injectable()
export class ResetPasswordUseCase implements UseCase<ResetPasswordCommand, void> {
  private readonly logger = new Logger(ResetPasswordUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasherPort,
    @Inject(PASSWORD_RESET_CODE_REPOSITORY)
    private readonly codeRepository: PasswordResetCodeRepositoryPort,
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(command: ResetPasswordCommand): Promise<void> {
    let email: Email;
    try {
      email = Email.create(command.email);
    } catch {
      throw new PasswordResetUnavailableException();
    }

    const user = await this.userRepository.findByEmailGlobally(email);
    if (!user || !user.canAuthenticate()) {
      throw new PasswordResetUnavailableException();
    }

    const code = await this.codeRepository.findLiveByUser(user.id);
    if (!code || !code.isUsable()) {
      throw new PasswordResetUnavailableException();
    }

    /**
     * A tentativa é contada e PERSISTIDA antes da comparação, em transação própria.
     *
     * A ordem é a regra do CLAUDE.md e o motivo é concreto: se o incremento só fosse gravado no
     * caminho de sucesso, quem estivesse adivinhando teria tentativas infinitas de graça, porque
     * cada palpite errado sairia sem deixar marca. Gravando antes, 1.000.000 de combinações viram
     * exatamente 5 chances.
     */
    code.registerAttempt();
    await this.unitOfWork.execute(async () => {
      await this.codeRepository.save(code);
    });

    const matches = await this.passwordHasher.compare(command.code, code.codeHash);
    if (!matches) {
      // Nem o código informado nem o esperado entram no log.
      this.logger.warn('Código de recuperação recusado', {
        userId: user.id.value,
        attempts: code.attempts,
      });
      throw new PasswordResetUnavailableException();
    }

    const newHash = await command.newPassword.use((plain) => this.passwordHasher.hash(plain));
    user.changePassword(newHash);
    code.markUsed();

    await this.unitOfWork.execute(async () => {
      await this.userRepository.save(user);
      await this.codeRepository.save(code);
    });

    this.logger.log('Senha redefinida por código do WhatsApp', { userId: user.id.value });
  }
}
