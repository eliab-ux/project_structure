import { ValueObject } from '@gitspread/domain-primitives';
import { randomUUID } from 'crypto';

interface ProductIdProps {
  value: string;
}

export class ProductId extends ValueObject<ProductIdProps> {
  private constructor(props: ProductIdProps) {
    super(props);
  }

  static generate(): ProductId {
    return new ProductId({ value: randomUUID() });
  }

  static from(id: string): ProductId {
    if (!this.isValid(id)) {
      throw new Error('Invalid Product ID format');
    }
    return new ProductId({ value: id });
  }

  private static isValid(id: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
  }

  get value(): string {
    return this.props.value;
  }
}
