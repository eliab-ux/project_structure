import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  PASSWORD_HASHER,
  PasswordHasherPort,
} from '../../../../../infrastructure/security/ports/password-hasher.port';
import {
  USER_REPOSITORY,
  UserRepositoryPort,
} from '../../../../user/application/ports/output/user-repository.port';
import { Email } from '../../../../user/domain/value-objects/email.vo';
import { InvalidResetCodeException } from '../../../domain/exceptions/invalid-reset-code.exception';
import {
  PASSWORD_RESET_CODE_REPOSITORY,
  PasswordResetCodeRepositoryPort,
} from '../../ports/output/password-reset-code-repository.port';

export interface ResetPasswordCommand {
  email: string;
  code: string;
  newPassword: string;
}

/**
 * Troca a senha usando o código recebido no WhatsApp.
 *
 * Toda recusa levanta a MESMA exceção (`InvalidResetCodeException`), e cada palpite errado é
 * contado no próprio código — é o que transforma 1.000.000 de combinações em 5 chances.
 */
@Injectable()
export class ResetPasswordUseCase implements UseCase<ResetPasswordCommand, void> {
  private readonly logger = new Logger(ResetPasswordUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(PASSWORD_RESET_CODE_REPOSITORY)
    private readonly codes: PasswordResetCodeRepositoryPort,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasherPort,
  ) {}

  async execute(command: ResetPasswordCommand): Promise<void> {
    const user = await this.users.findByEmail(Email.create(command.email));
    if (!user || !user.canAuthenticate) {
      throw new InvalidResetCodeException();
    }

    const code = await this.codes.findLatestUnused(user.id.value);
    if (!code || !code.isUsable()) {
      this.logger.warn('Código ausente, expirado ou sem tentativas', { userId: user.id.value });
      throw new InvalidResetCodeException();
    }

    if (!(await this.hasher.compare(command.code, code.codeHash))) {
      // A tentativa é contada ANTES de recusar: sem isso o código aceitaria palpites infinitos.
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

    user.changePassword(await this.hasher.hash(command.newPassword));
    await this.users.save(user);

    // Qualquer outro código vivo morre junto — inclusive um pedido em duplicidade.
    await this.codes.invalidateAllForUser(user.id.value, new Date());

    // Limitação conhecida e assumida: os refresh tokens já emitidos continuam valendo até
    // expirar, porque são JWT sem lista de revogação. Trocar a senha não derruba sessões
    // abertas em outros aparelhos. Resolver isso exige guardar os refresh tokens.
    this.logger.log('Senha redefinida com sucesso', { userId: user.id.value });
  }
}
