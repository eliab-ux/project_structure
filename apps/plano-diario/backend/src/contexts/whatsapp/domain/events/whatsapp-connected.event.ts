import { DomainEvent } from '@gitspread/domain-primitives';

export class WhatsappConnectedEvent extends DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly instanceName: string,
    /** Número conectado, só para exibição. Não é dado sensível de pagamento, mas evite logar. */
    public readonly connectedNumber: string | null,
  ) {
    super();
  }

  get eventName(): string {
    return 'whatsapp.connected';
  }
}
