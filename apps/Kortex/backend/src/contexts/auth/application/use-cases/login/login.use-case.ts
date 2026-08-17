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
import { TOKEN_SERVICE, TokenServicePort } from '../../ports/output/token-service.port';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import { AuthSessionDto } from '../../dto/authenticated-user.dto';
import { InvalidCredentialsException } from '../../../domain/exceptions/invalid-credentials.exception';
import { Email } from '../../../../../shared/domain/value-objects/email.vo';
import { PlainPassword } from '../../../../../shared/domain/value-objects/plain-password.vo';

export class LoginCommand {
  constructor(
    public readonly email: string,
    public readonly password: PlainPassword,
  ) {}
}

@Injectable()
export class LoginUseCase implements UseCase<LoginCommand, AuthSessionDto> {
  private readonly logger = new Logger(LoginUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasherPort,
    @Inject(TOKEN_SERVICE)
    private readonly tokenService: TokenServicePort,
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(command: LoginCommand): Promise<AuthSessionDto> {
    // Um e-mail malformado é credencial inválida, não erro de validação: responder 400 "e-mail
    // inválido" e 401 "credenciais inválidas" em situações diferentes já é meia resposta.
    let email: Email;
    try {
      email = Email.create(command.email);
    } catch {
      throw new InvalidCredentialsException();
    }

    const user = await this.userRepository.findByEmailGlobally(email);

    if (!user || !user.canAuthenticate()) {
      // A comparação de hash roda mesmo sem usuário para o tempo de resposta não denunciar a
      // diferença: sem isso, "e-mail não existe" volta em 2 ms e "senha errada" em 80 ms, e a
      // diferença é medível de fora.
      await this.burnTime(command.password);
      this.logger.warn('Falha na autenticação', {
        reason: user ? 'inactive_user' : 'unknown_email',
      });
      throw new InvalidCredentialsException();
    }

    const matches = await command.password.use((plain) =>
      this.passwordHasher.compare(plain, user.passwordHash),
    );
    if (!matches) {
      this.logger.warn('Falha na autenticação', {
        userId: user.id.value,
        reason: 'invalid_password',
      });
      throw new InvalidCredentialsException();
    }

    user.registerLogin();
    await this.unitOfWork.execute(async () => {
      await this.userRepository.save(user);
    });

    const tokens = this.tokenService.issue({
      sub: user.id.value,
      role: user.role,
      accountId: user.accountId.value,
    });

    // Sem senha, sem token, sem hash no log — só quem entrou.
    this.logger.log('Usuário autenticado', { userId: user.id.value, role: user.role });

    return AuthSessionDto.create(tokens, user);
  }

  /**
   * Compara a senha informada contra um hash descartável. O resultado é ignorado de propósito: o
   * que interessa é gastar o mesmo tempo de bcrypt que um login legítimo gastaria.
   */
  private async burnTime(password: PlainPassword): Promise<void> {
    const decoy = '$2a$10$abcdefghijklmnopqrstuvABCDEFGHIJKLMNOPQRSTUVWXYZ012345';
    await password.use((plain) => this.passwordHasher.compare(plain, decoy)).catch(() => undefined);
  }
}
