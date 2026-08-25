import { ValueObject } from '@gitspread/domain-primitives';
import { InvalidTimezoneException } from '../exceptions/invalid-timezone.exception';

interface Props {
  value: string;
}

/**
 * Fuso horário IANA (`America/Sao_Paulo`). Validado contra o próprio ICU do Node em vez de uma
 * lista mantida à mão: um fuso inválido aqui faria o envio diário nunca acontecer, porque a
 * comparação de hora local jamais casaria.
 */
export class Timezone extends ValueObject<Props> {
  static readonly DEFAULT = 'America/Sao_Paulo';

  private constructor(props: Props) {
    super(props);
  }

  static create(value?: string | null): Timezone {
    const candidate = (value ?? Timezone.DEFAULT).trim();
    if (!Timezone.isValid(candidate)) {
      throw new InvalidTimezoneException();
    }
    return new Timezone({ value: candidate });
  }

  static isValid(value: string): boolean {
    if (!value) {
      return false;
    }
    try {
      // Lança RangeError quando o fuso não existe.
      new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date());
      return true;
    } catch {
      return false;
    }
  }

  get value(): string {
    return this.props.value;
  }
}
