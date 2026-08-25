import { DomainEvent } from '@gitspread/domain-primitives';

export class StockUpdatedEvent extends DomainEvent {
  constructor(
    public readonly productId: string,
    public readonly sku: string,
    public readonly previousStock: number,
    public readonly newStock: number,
  ) {
    super();
  }

  get eventName(): string {
    return 'product.stock.updated';
  }
}
