import { ValueObject } from '@gitspread/domain-primitives';

interface EmailProps {
  value: string;
}

export class Email extends ValueObject<EmailProps> {
  private constructor(props: EmailProps) {
    super(props);
  }

  static create(email: string): Email {
    const normalized = email.toLowerCase().trim();
    if (!this.isValid(normalized)) {
      throw new Error(`Invalid email format: ${email}`);
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
