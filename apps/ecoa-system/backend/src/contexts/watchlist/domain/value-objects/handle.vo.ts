import { ValueObject } from '@gitspread/domain-primitives';
import { InvalidHandleException } from '../exceptions/invalid-handle.exception';

interface HandleProps {
  value: string;
}

/**
 * Instagram handle, stored WITHOUT the leading '@' and lowercased. Normalization strips a
 * single leading '@', trims and lowercases; validation enforces the Instagram handle charset.
 */
export class Handle extends ValueObject<HandleProps> {
  private constructor(props: HandleProps) {
    super(props);
  }

  static create(raw: string): Handle {
    const normalized = (raw ?? '').trim().replace(/^@+/, '').toLowerCase();
    if (!this.isValid(normalized)) {
      throw new InvalidHandleException(raw);
    }
    return new Handle({ value: normalized });
  }

  private static isValid(handle: string): boolean {
    return /^[a-z0-9._]{1,30}$/.test(handle);
  }

  get value(): string {
    return this.props.value;
  }
}
