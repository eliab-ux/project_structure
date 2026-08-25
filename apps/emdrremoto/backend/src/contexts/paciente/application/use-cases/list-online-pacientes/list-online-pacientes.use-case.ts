import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  PACIENTE_REPOSITORY,
  PacienteRepositoryPort,
} from '../../ports/output/paciente-repository.port';
import { PACIENTE_PRESENCE, PresencePort } from '../../ports/output/presence.port';

export class ListOnlinePacientesQuery {
  constructor(public readonly psicologoId: string) {}
}

/**
 * IDs dos pacientes DESTE psicólogo que estão online agora (numa sala de sessão).
 * Só retorna ids do próprio psicólogo (menor privilégio — não vaza presença alheia).
 */
@Injectable()
export class ListOnlinePacientesUseCase implements UseCase<ListOnlinePacientesQuery, string[]> {
  constructor(
    @Inject(PACIENTE_REPOSITORY) private readonly repository: PacienteRepositoryPort,
    @Inject(PACIENTE_PRESENCE) private readonly presence: PresencePort,
  ) {}

  async execute(query: ListOnlinePacientesQuery): Promise<string[]> {
    const pacientes = await this.repository.findByPsicologo(query.psicologoId);
    return pacientes.filter((p) => this.presence.isOnline(p.id.value)).map((p) => p.id.value);
  }
}
