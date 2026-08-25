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
import { Paciente } from '../../../domain/entities/paciente.entity';
import { PacienteDto } from '../../dto/paciente.dto';

export class CreatePacienteCommand {
  constructor(
    public readonly psicologoId: string,
    public readonly email: string,
    public readonly nome: string,
    public readonly telefone: string,
    public readonly pais?: string | null,
  ) {}
}

@Injectable()
export class CreatePacienteUseCase implements UseCase<CreatePacienteCommand, PacienteDto> {
  constructor(
    @Inject(PACIENTE_REPOSITORY) private readonly repository: PacienteRepositoryPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: CreatePacienteCommand): Promise<PacienteDto> {
    const paciente = Paciente.create({
      psicologoId: command.psicologoId,
      email: command.email,
      nome: command.nome,
      telefone: command.telefone,
      pais: command.pais ?? null,
    });
    const saved = await this.uow.execute(() => this.repository.save(paciente));
    return PacienteDto.fromDomain(saved);
  }
}
