import { DomainEvent } from '@gitspread/domain-primitives';

export class PacienteCreatedEvent extends DomainEvent {
  constructor(
    public readonly pacienteId: string,
    public readonly psicologoId: string,
    public readonly email: string,
  ) {
    super();
  }

  get eventName(): string {
    return 'paciente.created';
  }
}
