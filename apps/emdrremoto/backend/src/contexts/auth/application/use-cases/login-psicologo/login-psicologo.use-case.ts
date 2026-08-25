import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  PSICOLOGO_REPOSITORY,
  PsicologoRepositoryPort,
} from '../../../../psicologo/application/ports/output/psicologo-repository.port';
import { Email } from '../../../../psicologo/domain/value-objects/email.vo';
import { PsicologoDto } from '../../../../psicologo/application/dto/psicologo.dto';
import {
  PASSWORD_HASHER,
  PasswordHasherPort,
} from '../../../../../infrastructure/security/ports/password-hasher.port';
import {
  TOKEN_SERVICE,
  TokenServicePort,
} from '../../../../../infrastructure/security/ports/token-service.port';
import {
  EmailNotVerifiedException,
  InvalidCredentialsException,
} from '../../../domain/exceptions/auth.exceptions';
import { LoginResultDto } from '../../dto/auth-result.dto';

export class LoginPsicologoCommand {
  constructor(
    public readonly email: string,
    public readonly senha: string,
  ) {}
}

@Injectable()
export class LoginPsicologoUseCase implements UseCase<LoginPsicologoCommand, LoginResultDto> {
  constructor(
    @Inject(PSICOLOGO_REPOSITORY) private readonly psicologos: PsicologoRepositoryPort,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasherPort,
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenServicePort,
  ) {}

  async execute(command: LoginPsicologoCommand): Promise<LoginResultDto> {
    const psicologo = await this.psicologos.findByEmail(Email.create(command.email));
    // Mensagem genérica sempre — não revela se o e-mail existe (evita enumeração).
    if (!psicologo) {
      throw new InvalidCredentialsException();
    }
    const ok = await this.hasher.compare(command.senha, psicologo.passwordHash);
    if (!ok) {
      throw new InvalidCredentialsException();
    }
    if (!psicologo.emailVerificado) {
      throw new EmailNotVerifiedException();
    }

    const payload = {
      sub: psicologo.id.value,
      role: 'psicologo' as const,
      email: psicologo.email.value,
      nome: psicologo.nome,
    };

    return {
      accessToken: await this.tokens.signAccessToken(payload),
      refreshToken: await this.tokens.signRefreshToken(payload),
      psicologo: PsicologoDto.fromDomain(psicologo),
    };
  }
}
