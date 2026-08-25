import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  PACIENTE_REPOSITORY,
  PacienteRepositoryPort,
} from '../../ports/output/paciente-repository.port';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import { PacienteId } from '../../../domain/value-objects/paciente-id.vo';
import { PacienteNotFoundException } from '../../../domain/exceptions/paciente.exceptions';

export class DeletePacienteCommand {
  constructor(
    public readonly pacienteId: string,
    public readonly psicologoId: string,
  ) {}
}

@Injectable()
export class DeletePacienteUseCase implements UseCase<DeletePacienteCommand, void> {
  constructor(
    @Inject(PACIENTE_REPOSITORY) private readonly repository: PacienteRepositoryPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: DeletePacienteCommand): Promise<void> {
    const id = PacienteId.from(command.pacienteId);
    const paciente = await this.repository.findById(id);
    // Menor privilégio: o psicólogo só pode remover os próprios pacientes.
    if (!paciente || paciente.psicologoId !== command.psicologoId) {
      throw new PacienteNotFoundException(command.pacienteId);
    }
    await this.uow.execute(() => this.repository.delete(id));
  }
}
