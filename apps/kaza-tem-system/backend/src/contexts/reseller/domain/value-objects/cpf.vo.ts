import { ValueObject } from '@gitspread/domain-primitives';
import { InvalidCPFException } from '../exceptions/invalid-cpf.exception';

interface CPFProps {
  value: string;
}

export class CPF extends ValueObject<CPFProps> {
  private constructor(props: CPFProps) {
    super(props);
  }

  static create(cpf: string): CPF {
    const cleaned = cpf.replace(/\D/g, '');

    if (cleaned.length !== 11) {
      throw new InvalidCPFException('CPF must have 11 digits');
    }

    if (!CPF.isValid(cleaned)) {
      throw new InvalidCPFException('Invalid CPF');
    }

    return new CPF({ value: cleaned });
  }

  private static isValid(cpf: string): boolean {
    if (/^(\d)\1+$/.test(cpf)) {
      return false;
    }

    let sum = 0;
    let remainder: number;

    for (let i = 1; i <= 9; i++) {
      sum += parseInt(cpf.substring(i - 1, i), 10) * (11 - i);
    }

    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cpf.substring(9, 10), 10)) return false;

    sum = 0;
    for (let i = 1; i <= 10; i++) {
      sum += parseInt(cpf.substring(i - 1, i), 10) * (12 - i);
    }

    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cpf.substring(10, 11), 10)) return false;

    return true;
  }

  get value(): string {
    return this.props.value;
  }

  format(): string {
    const cpf = this.props.value;
    return `${cpf.substring(0, 3)}.${cpf.substring(3, 6)}.${cpf.substring(6, 9)}-${cpf.substring(9, 11)}`;
  }
}
