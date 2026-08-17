import { ValueObject } from '@gitspread/domain-primitives';
import { ValidationUtil } from '@gitspread/shared-kernel';
import { InvalidValueException } from '../exceptions/invalid-value.exception';

interface CnpjProps {
  value: string;
}

/** CNPJ com dígito verificador conferido no construtor. Guarda só dígitos — ver `CPF`. */
export class CNPJ extends ValueObject<CnpjProps> {
  private constructor(props: CnpjProps) {
    super(props);
  }

  static create(raw: string): CNPJ {
    const value = (raw ?? '').replace(/\D/g, '');

    if (!ValidationUtil.isValidCNPJ(value)) {
      throw new InvalidValueException('CNPJ inválido.');
    }

    return new CNPJ({ value });
  }

  get value(): string {
    return this.props.value;
  }

  /** '11222333000181' → '11.222.333/0001-81'. */
  get formatted(): string {
    const v = this.props.value;
    return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8, 12)}-${v.slice(12)}`;
  }

  toString(): string {
    return this.formatted;
  }
}
