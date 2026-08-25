import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  PACIENTE_REPOSITORY,
  PacienteRepositoryPort,
} from '../../ports/output/paciente-repository.port';
import { PacienteDto } from '../../dto/paciente.dto';

export class ListPacientesQuery {
  constructor(public readonly psicologoId: string) {}
}

@Injectable()
export class ListPacientesUseCase implements UseCase<ListPacientesQuery, PacienteDto[]> {
  constructor(@Inject(PACIENTE_REPOSITORY) private readonly repository: PacienteRepositoryPort) {}

  async execute(query: ListPacientesQuery): Promise<PacienteDto[]> {
    const pacientes = await this.repository.findByPsicologo(query.psicologoId);
    return pacientes.map((p) => PacienteDto.fromDomain(p));
  }
}
