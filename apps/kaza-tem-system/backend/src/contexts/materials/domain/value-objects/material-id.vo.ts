import { ValueObject } from '@gitspread/domain-primitives';
import { randomUUID } from 'crypto';

interface MaterialIdProps {
  value: string;
}

export class MaterialId extends ValueObject<MaterialIdProps> {
  private constructor(props: MaterialIdProps) {
    super(props);
  }

  static generate(): MaterialId {
    return new MaterialId({ value: randomUUID() });
  }

  static from(value: string): MaterialId {
    if (!this.isValid(value)) {
      throw new Error('Material ID inválido');
    }
    return new MaterialId({ value });
  }

  private static isValid(value: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
  }

  get value(): string {
    return this.props.value;
  }
}
