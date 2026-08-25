import { ValueObject } from '@gitspread/domain-primitives';
import { InvalidDocumentException } from '../exceptions/invalid-document.exception';

/** CPF (11 digits) or CNPJ (14 digits) of the account holder, stored as digits only. */
export class Document extends ValueObject<{ value: string }> {
  private constructor(props: { value: string }) {
    super(props);
  }

  static create(raw: string): Document {
    const digits = (raw ?? '').replace(/\D/g, '');

    if (digits.length === 11) {
      if (!Document.isValidCpf(digits)) {
        throw new InvalidDocumentException();
      }
    } else if (digits.length === 14) {
      if (!Document.isValidCnpj(digits)) {
        throw new InvalidDocumentException();
      }
    } else {
      throw new InvalidDocumentException();
    }

    return new Document({ value: digits });
  }

  get value(): string {
    return this.props.value;
  }

  get isCompany(): boolean {
    return this.props.value.length === 14;
  }

  /** Masked for display and for logs — never log the full document. */
  get masked(): string {
    const v = this.props.value;
    return `${v.slice(0, 3)}${'*'.repeat(Math.max(0, v.length - 5))}${v.slice(-2)}`;
  }

  private static isValidCpf(cpf: string): boolean {
    if (/^(\d)\1{10}$/.test(cpf)) {
      return false;
    }
    const digit = (slice: number): number => {
      let sum = 0;
      for (let i = 0; i < slice; i += 1) {
        sum += Number(cpf[i]) * (slice + 1 - i);
      }
      const rest = (sum * 10) % 11;
      return rest === 10 ? 0 : rest;
    };
    return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
  }

  private static isValidCnpj(cnpj: string): boolean {
    if (/^(\d)\1{13}$/.test(cnpj)) {
      return false;
    }
    const digit = (length: number): number => {
      const weights =
        length === 12
          ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
          : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
      let sum = 0;
      for (let i = 0; i < length; i += 1) {
        sum += Number(cnpj[i]) * weights[i];
      }
      const rest = sum % 11;
      return rest < 2 ? 0 : 11 - rest;
    };
    return digit(12) === Number(cnpj[12]) && digit(13) === Number(cnpj[13]);
  }
}
