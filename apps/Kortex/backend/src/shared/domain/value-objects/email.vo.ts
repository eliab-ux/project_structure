import { ValueObject } from '@gitspread/domain-primitives';
import { ValidationUtil } from '@gitspread/shared-kernel';
import { InvalidValueException } from '../exceptions/invalid-value.exception';

const MAX_LENGTH = 255;

interface EmailProps {
  value: string;
}

/**
 * E-mail normalizado. É o login do sistema (spec §7, Fase 1), então a normalização não é
 * cosmética: sem `toLowerCase`, "Bia@..." e "bia@..." seriam duas contas diferentes para o índice
 * único e a mesma pessoa para o usuário.
 */
export class Email extends ValueObject<EmailProps> {
  private constructor(props: EmailProps) {
    super(props);
  }

  static create(raw: string): Email {
    const value = (raw ?? '').trim().toLowerCase();

    if (!ValidationUtil.isEmail(value)) {
      throw new InvalidValueException('E-mail inválido.');
    }
    if (value.length > MAX_LENGTH) {
      throw new InvalidValueException(`E-mail deve ter no máximo ${MAX_LENGTH} caracteres.`);
    }

    return new Email({ value });
  }

  get value(): string {
    return this.props.value;
  }

  toString(): string {
    return this.props.value;
  }
}
