import { DomainEvent } from '@gitspread/domain-primitives';

export class SessionCreatedEvent extends DomainEvent {
  constructor(
    public readonly sessionId: string,
    public readonly sessionCode: string,
    public readonly psicologoId: string,
    public readonly pacienteId: string,
  ) {
    super();
  }

  get eventName(): string {
    return 'session.created';
  }
}
