import { ValueObject } from '@gitspread/domain-primitives';
import { InvalidValueException } from '../exceptions/invalid-value.exception';

/** R$ 10.000,00/hora. Teto de sanidade contra o erro de digitar centavos como reais. */
const MAX_CENTS = 1_000_000;

interface MoneyProps {
  cents: number;
}

/**
 * Dinheiro em centavos inteiros. Nunca `number` de reais e nunca `float`: `0.1 + 0.2` em ponto
 * flutuante não dá `0.3`, e a única coisa pior do que um sistema que erra o valor é um que erra
 * um centavo por vez, devagar, sem ninguém perceber.
 */
export class Money extends ValueObject<MoneyProps> {
  private constructor(props: MoneyProps) {
    super(props);
  }

  static fromCents(cents: number): Money {
    if (!Number.isInteger(cents)) {
      throw new InvalidValueException('Valor deve ser informado em centavos inteiros.');
    }
    if (cents <= 0) {
      throw new InvalidValueException('Valor deve ser maior que zero.');
    }
    if (cents > MAX_CENTS) {
      throw new InvalidValueException('Valor acima do limite permitido.');
    }
    return new Money({ cents });
  }

  get cents(): number {
    return this.props.cents;
  }

  multiply(factor: number): Money {
    if (!Number.isInteger(factor) || factor <= 0) {
      throw new InvalidValueException('Multiplicador deve ser um inteiro positivo.');
    }
    return Money.fromCents(this.props.cents * factor);
  }
}
