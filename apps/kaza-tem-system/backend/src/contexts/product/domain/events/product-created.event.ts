import { DomainEvent } from '@gitspread/domain-primitives';

export class ProductCreatedEvent extends DomainEvent {
  constructor(
    public readonly productId: string,
    public readonly sku: string,
    public readonly name: string,
  ) {
    super();
  }

  get eventName(): string {
    return 'product.created';
  }
}
