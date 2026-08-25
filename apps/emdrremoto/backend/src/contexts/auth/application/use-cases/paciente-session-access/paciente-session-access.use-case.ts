import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  PACIENTE_REPOSITORY,
  PacienteRepositoryPort,
} from '../../../../paciente/application/ports/output/paciente-repository.port';
import { PacienteNotFoundException } from '../../../../paciente/domain/exceptions/paciente.exceptions';
import {
  TOKEN_SERVICE,
  TokenServicePort,
} from '../../../../../infrastructure/security/ports/token-service.port';
import { PacienteAccessResultDto } from '../../dto/auth-result.dto';

export class PacienteSessionAccessCommand {
  constructor(public readonly hash: string) {}
}

/**
 * Acesso do paciente sem senha: o `hash` de convite é a credencial. Troca o hash por um
 * access token de role 'paciente' (curto), usado para autenticar o handshake do Socket.IO.
 */
@Injectable()
export class PacienteSessionAccessUseCase implements UseCase<
  PacienteSessionAccessCommand,
  PacienteAccessResultDto
> {
  constructor(
    @Inject(PACIENTE_REPOSITORY) private readonly pacientes: PacienteRepositoryPort,
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenServicePort,
  ) {}

  async execute(command: PacienteSessionAccessCommand): Promise<PacienteAccessResultDto> {
    const paciente = await this.pacientes.findByHash(command.hash);
    if (!paciente) {
      throw new PacienteNotFoundException('hash inválido');
    }

    const accessToken = await this.tokens.signAccessToken({
      sub: paciente.id.value,
      role: 'paciente',
      nome: paciente.nome,
    });

    return { accessToken, nome: paciente.nome };
  }
}
