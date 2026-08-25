import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  PACIENTE_REPOSITORY,
  PacienteRepositoryPort,
} from '../../ports/output/paciente-repository.port';
import { PacientePublicDto } from '../../dto/paciente.dto';
import { PacienteNotFoundException } from '../../../domain/exceptions/paciente.exceptions';

export class GetPacienteByHashQuery {
  constructor(public readonly hash: string) {}
}

@Injectable()
export class GetPacienteByHashUseCase implements UseCase<
  GetPacienteByHashQuery,
  PacientePublicDto
> {
  constructor(@Inject(PACIENTE_REPOSITORY) private readonly repository: PacienteRepositoryPort) {}

  async execute(query: GetPacienteByHashQuery): Promise<PacientePublicDto> {
    const paciente = await this.repository.findByHash(query.hash);
    if (!paciente) {
      throw new PacienteNotFoundException('hash inválido');
    }
    return PacientePublicDto.fromDomain(paciente);
  }
}
