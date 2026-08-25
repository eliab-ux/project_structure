import { ValueObject } from '@gitspread/domain-primitives';
import { InvalidEmailException } from '../exceptions/invalid-email.exception';

interface EmailProps {
  value: string;
}

/**
 * Invariante: só existe Email válido e normalizado (lowercase, sem espaços nas pontas).
 * A normalização acontece aqui para que a unicidade no banco seja confiável — dois cadastros
 * com "A@x.com" e "a@x.com" não podem virar duas contas.
 */
export class Email extends ValueObject<EmailProps> {
  private constructor(props: EmailProps) {
    super(props);
  }

  static create(email: string): Email {
    const normalized = (email ?? '').toLowerCase().trim();
    if (!this.isValid(normalized)) {
      throw new InvalidEmailException();
    }
    return new Email({ value: normalized });
  }

  private static isValid(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 255;
  }

  get value(): string {
    return this.props.value;
  }
}
