import { DomainEvent } from '@gitspread/domain-primitives';

export class PsicologoRegisteredEvent extends DomainEvent {
  constructor(
    public readonly psicologoId: string,
    public readonly email: string,
    public readonly nome: string,
  ) {
    super();
  }

  get eventName(): string {
    return 'psicologo.registered';
  }
}
