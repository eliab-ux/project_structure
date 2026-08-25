import { ValueObject } from '@gitspread/domain-primitives';
import { InvalidSKUException } from '../exceptions/invalid-sku.exception';

interface SKUProps {
  value: string;
}

export class SKU extends ValueObject<SKUProps> {
  private constructor(props: SKUProps) {
    super(props);
  }

  static create(sku: string): SKU {
    if (!sku || sku.trim().length === 0) {
      throw new InvalidSKUException('SKU cannot be empty');
    }

    if (sku.length > 100) {
      throw new InvalidSKUException('SKU cannot exceed 100 characters');
    }

    return new SKU({ value: sku.trim().toUpperCase() });
  }

  get value(): string {
    return this.props.value;
  }
}
