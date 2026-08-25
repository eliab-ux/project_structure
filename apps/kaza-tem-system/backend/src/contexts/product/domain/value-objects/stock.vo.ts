import { ValueObject } from '@gitspread/domain-primitives';
import { InvalidStockException } from '../exceptions/invalid-stock.exception';

interface StockProps {
  quantity: number;
}

export class Stock extends ValueObject<StockProps> {
  private constructor(props: StockProps) {
    super(props);
  }

  static create(quantity: number): Stock {
    if (quantity < 0) {
      throw new InvalidStockException('Stock cannot be negative');
    }

    if (!Number.isInteger(quantity)) {
      throw new InvalidStockException('Stock must be an integer');
    }

    return new Stock({ quantity });
  }

  get value(): number {
    return this.props.quantity;
  }

  isAvailable(requestedQuantity: number): boolean {
    return this.value >= requestedQuantity;
  }

  decrease(quantity: number): Stock {
    return Stock.create(this.value - quantity);
  }

  increase(quantity: number): Stock {
    return Stock.create(this.value + quantity);
  }
}
