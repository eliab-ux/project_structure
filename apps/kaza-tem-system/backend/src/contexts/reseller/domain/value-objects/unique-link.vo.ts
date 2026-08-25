import { ValueObject } from '@gitspread/domain-primitives';
import { randomBytes } from 'crypto';

interface UniqueLinkProps {
  code: string;
}

export class UniqueLink extends ValueObject<UniqueLinkProps> {
  private constructor(props: UniqueLinkProps) {
    super(props);
  }

  static generate(userName: string): UniqueLink {
    const sanitized = userName
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .substring(0, 30);

    const randomCode = randomBytes(4).toString('hex').toUpperCase();

    return new UniqueLink({ code: `${sanitized}_${randomCode}` });
  }

  static from(code: string): UniqueLink {
    return new UniqueLink({ code });
  }

  get value(): string {
    return this.props.code;
  }

  getFullUrl(baseUrl: string): string {
    return `${baseUrl}/r/${this.value}`;
  }
}
