import { DomainEvent } from '@gitspread/domain-primitives';

export class WhatsappDisconnectedEvent extends DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly instanceName: string,
  ) {
    super();
  }

  get eventName(): string {
    return 'whatsapp.disconnected';
  }
}
