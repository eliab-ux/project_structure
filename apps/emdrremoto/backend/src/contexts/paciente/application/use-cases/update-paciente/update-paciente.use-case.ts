import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  PACIENTE_REPOSITORY,
  PacienteRepositoryPort,
} from '../../ports/output/paciente-repository.port';
import { UNIT_OF_WORK, UnitOfWorkPort } from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import { PacienteId } from '../../../domain/value-objects/paciente-id.vo';
import { PacienteNotFoundException } from '../../../domain/exceptions/paciente.exceptions';
import { PacienteDto } from '../../dto/paciente.dto';

export class UpdatePacienteCommand {
  constructor(
    public readonly pacienteId: string,
    public readonly psicologoId: string,
    public readonly email: string,
    public readonly nome: string,
    public readonly telefone: string,
    public readonly pais?: string | null,
  ) {}
}

@Injectable()
export class UpdatePacienteUseCase implements UseCase<UpdatePacienteCommand, PacienteDto> {
  constructor(
    @Inject(PACIENTE_REPOSITORY) private readonly repository: PacienteRepositoryPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: UpdatePacienteCommand): Promise<PacienteDto> {
    const paciente = await this.repository.findById(PacienteId.from(command.pacienteId));
    // Menor privilégio: o psicólogo só altera os próprios pacientes.
    if (!paciente || paciente.psicologoId !== command.psicologoId) {
      throw new PacienteNotFoundException(command.pacienteId);
    }
    paciente.updateDetails({
      email: command.email,
      nome: command.nome,
      telefone: command.telefone,
      pais: command.pais ?? null,
    });
    const saved = await this.uow.execute(() => this.repository.save(paciente));
    return PacienteDto.fromDomain(saved);
  }
}
