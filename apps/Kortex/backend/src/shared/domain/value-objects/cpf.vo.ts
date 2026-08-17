import { ValueObject } from '@gitspread/domain-primitives';
import { ValidationUtil } from '@gitspread/shared-kernel';
import { InvalidValueException } from '../exceptions/invalid-value.exception';

interface CpfProps {
  value: string;
}

/**
 * CPF com dígito verificador conferido no construtor — a entidade nunca existe com um CPF que não
 * fecha.
 *
 * Guarda **só dígitos**. Máscara é apresentação, e guardar `529.982.247-25` faria o índice único
 * de documento deixar passar o mesmo número digitado sem pontuação.
 *
 * É dado pessoal sensível (spec §4.4): nunca em log, nunca em DTO de listagem. Por isso a
 * mensagem de erro não repete o valor recusado, e `toJSON` devolve mascarado — um
 * `JSON.stringify` acidental de um comando ou de um objeto de erro não pode publicar o número.
 */
export class CPF extends ValueObject<CpfProps> {
  private constructor(props: CpfProps) {
    super(props);
  }

  static create(raw: string): CPF {
    const value = (raw ?? '').replace(/\D/g, '');

    if (!ValidationUtil.isValidCPF(value)) {
      throw new InvalidValueException('CPF inválido.');
    }

    return new CPF({ value });
  }

  get value(): string {
    return this.props.value;
  }

  /** '52998224725' → '529.982.247-25'. Só para a tela de detalhe. */
  get formatted(): string {
    const v = this.props.value;
    return `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6, 9)}-${v.slice(9)}`;
  }

  /** '529.982.247-25' → '***.982.247-**'. O que pode aparecer em tela de apoio ou suporte. */
  get masked(): string {
    const v = this.props.value;
    return `***.${v.slice(3, 6)}.${v.slice(6, 9)}-**`;
  }

  toJSON(): string {
    return this.masked;
  }

  toString(): string {
    return this.masked;
  }
}
