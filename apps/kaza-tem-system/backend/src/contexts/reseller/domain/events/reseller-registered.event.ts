import { DomainEvent } from '@gitspread/domain-primitives';

export class ResellerRegisteredEvent extends DomainEvent {
  constructor(
    public readonly resellerId: string,
    public readonly userId: string,
    public readonly cpf: string,
  ) {
    super();
  }

  get eventName(): string {
    return 'reseller.registered';
  }
}
