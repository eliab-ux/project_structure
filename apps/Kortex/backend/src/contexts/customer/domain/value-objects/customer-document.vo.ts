import { InvalidValueException } from '../../../../shared/domain/exceptions/invalid-value.exception';
import { CNPJ } from '../../../../shared/domain/value-objects/cnpj.vo';
import { CPF } from '../../../../shared/domain/value-objects/cpf.vo';

export const DOCUMENT_TYPES = ['cnpj', 'cpf'] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

/**
 * O documento da empresa cliente — CNPJ **ou** CPF (spec §4.4).
 *
 * Os dois existem porque facção pequena e costureira autônoma da região podem não ter CNPJ, e
 * exigir CNPJ de todos travaria cliente real na porta. O tipo não é um rótulo solto ao lado do
 * número: é ele que decide qual validação de dígito roda, e guardá-los juntos impede o par
 * inconsistente (`type: 'cnpj'` com 11 dígitos) de existir.
 */
export class CustomerDocument {
  private constructor(
    private readonly _type: DocumentType,
    private readonly _digits: string,
    private readonly _formatted: string,
  ) {}

  static create(type: string, raw: string): CustomerDocument {
    if (!DOCUMENT_TYPES.includes(type as DocumentType)) {
      throw new InvalidValueException('Tipo de documento deve ser cnpj ou cpf.');
    }

    if (type === 'cnpj') {
      const cnpj = CNPJ.create(raw);
      return new CustomerDocument('cnpj', cnpj.value, cnpj.formatted);
    }

    const cpf = CPF.create(raw);
    return new CustomerDocument('cpf', cpf.value, cpf.formatted);
  }

  get type(): DocumentType {
    return this._type;
  }

  /** Só dígitos — é o que vai para a coluna e para o índice único por conta. */
  get value(): string {
    return this._digits;
  }

  get formatted(): string {
    return this._formatted;
  }

  equals(other: CustomerDocument): boolean {
    return this._type === other._type && this._digits === other._digits;
  }
}
