import { ValueObject } from '@gitspread/domain-primitives';
import { InvalidDocumentException } from '../exceptions/invalid-document.exception';

export enum DocumentType {
  CPF = 'CPF',
  CNPJ = 'CNPJ',
}

/**
 * A Brazilian fiscal document — CPF (11 digits) or CNPJ (14) — stored as DIGITS ONLY.
 *
 * Digits only in the database, formatting only at the edge: a document typed as `12.345.678/0001-95`
 * and one typed as `12345678000195` are the same company, and storing the punctuation would make the
 * uniqueness index unable to see that.
 *
 * Check digits are verified here, in the domain, and not only by a `class-validator` decorator. The
 * DTO layer catches a malformed payload; this catches a document that is well-formed and still
 * impossible — the invariant survives an import, a seed and the CLI, none of which pass through a DTO.
 *
 * `ValidationUtil` of `@gitspread/shared-kernel` advertises `isValidCPF` in CLAUDE.md but does not
 * actually implement it, so the algorithm lives here rather than in a package five apps depend on.
 */
export class Document extends ValueObject<{ value: string; type: DocumentType }> {
  private constructor(props: { value: string; type: DocumentType }) {
    super(props);
  }

  /** Accepts either kind — used by `account`, and later by the unified contact register. */
  static create(raw: string): Document {
    const digits = Document.onlyDigits(raw);

    if (digits.length === 11) {
      if (!Document.isValidCpf(digits)) {
        throw new InvalidDocumentException('CPF inválido.');
      }
      return new Document({ value: digits, type: DocumentType.CPF });
    }

    if (digits.length === 14) {
      if (!Document.isValidCnpj(digits)) {
        throw new InvalidDocumentException('CNPJ inválido.');
      }
      return new Document({ value: digits, type: DocumentType.CNPJ });
    }

    throw new InvalidDocumentException('CPF deve ter 11 dígitos e CNPJ, 14.');
  }

  /**
   * CNPJ only. Used by `company`, where a CPF is not merely unusual but unusable: the whole fiscal
   * module keys off a CNPJ, so accepting one here would fail much later, at the first NF-e.
   */
  static cnpj(raw: string): Document {
    const document = Document.create(raw);
    if (document.type !== DocumentType.CNPJ) {
      throw new InvalidDocumentException('A empresa precisa de um CNPJ (14 dígitos).');
    }
    return document;
  }

  get value(): string {
    return this.props.value;
  }

  get type(): DocumentType {
    return this.props.type;
  }

  /** Formatted for display. The stored value stays unformatted. */
  get formatted(): string {
    const v = this.props.value;
    return this.props.type === DocumentType.CPF
      ? `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6, 9)}-${v.slice(9)}`
      : `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8, 12)}-${v.slice(12)}`;
  }

  /** For logs: CPF is personal data and CLAUDE.md forbids logging it whole. */
  get masked(): string {
    const v = this.props.value;
    return `${'*'.repeat(v.length - 4)}${v.slice(-4)}`;
  }

  private static onlyDigits(raw: string): string {
    return (raw ?? '').replace(/\D/g, '');
  }

  private static isValidCpf(cpf: string): boolean {
    // All-equal digits pass the check-digit arithmetic (000.000.000-00 computes correctly), so they
    // have to be excluded explicitly — they are the classic placeholder that slips through.
    if (/^(\d)\1{10}$/.test(cpf)) {
      return false;
    }
    const digits = cpf.split('').map(Number);
    for (const [length, start] of [
      [9, 10],
      [10, 11],
    ]) {
      let sum = 0;
      for (let i = 0; i < length; i += 1) {
        sum += digits[i] * (start - i);
      }
      const remainder = (sum * 10) % 11;
      const expected = remainder === 10 ? 0 : remainder;
      if (expected !== digits[length]) {
        return false;
      }
    }
    return true;
  }

  private static isValidCnpj(cnpj: string): boolean {
    if (/^(\d)\1{13}$/.test(cnpj)) {
      return false;
    }
    const digits = cnpj.split('').map(Number);
    const weightsFirst = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const weightsSecond = [6, ...weightsFirst];

    for (const [weights, position] of [
      [weightsFirst, 12],
      [weightsSecond, 13],
    ] as [number[], number][]) {
      const sum = weights.reduce((acc, weight, i) => acc + digits[i] * weight, 0);
      const remainder = sum % 11;
      const expected = remainder < 2 ? 0 : 11 - remainder;
      if (expected !== digits[position]) {
        return false;
      }
    }
    return true;
  }
}
