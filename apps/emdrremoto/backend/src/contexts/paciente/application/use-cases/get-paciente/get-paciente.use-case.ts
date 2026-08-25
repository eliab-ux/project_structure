import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  PACIENTE_REPOSITORY,
  PacienteRepositoryPort,
} from '../../ports/output/paciente-repository.port';
import { PacienteId } from '../../../domain/value-objects/paciente-id.vo';
import { PacienteNotFoundException } from '../../../domain/exceptions/paciente.exceptions';
import { PacienteDto } from '../../dto/paciente.dto';

export class GetPacienteQuery {
  constructor(
    public readonly pacienteId: string,
    public readonly psicologoId: string,
  ) {}
}

@Injectable()
export class GetPacienteUseCase implements UseCase<GetPacienteQuery, PacienteDto> {
  constructor(
    @Inject(PACIENTE_REPOSITORY) private readonly repository: PacienteRepositoryPort,
  ) {}

  async execute(query: GetPacienteQuery): Promise<PacienteDto> {
    const paciente = await this.repository.findById(PacienteId.from(query.pacienteId));
    if (!paciente || paciente.psicologoId !== query.psicologoId) {
      throw new PacienteNotFoundException(query.pacienteId);
    }
    return PacienteDto.fromDomain(paciente);
  }
}
