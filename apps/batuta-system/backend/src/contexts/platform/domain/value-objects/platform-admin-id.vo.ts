import { randomUUID } from 'crypto';
import { ValueObject } from '@gitspread/domain-primitives';
import { ValidationUtil } from '@gitspread/shared-kernel';
import { InvalidPlatformAdminIdException } from '../exceptions/invalid-platform-admin-id.exception';

export class PlatformAdminId extends ValueObject<{ value: string }> {
  private constructor(props: { value: string }) {
    super(props);
    if (!ValidationUtil.isUUID(props.value)) {
      throw new InvalidPlatformAdminIdException();
    }
  }

  static generate(): PlatformAdminId {
    return new PlatformAdminId({ value: randomUUID() });
  }

  static from(value: string): PlatformAdminId {
    return new PlatformAdminId({ value });
  }

  get value(): string {
    return this.props.value;
  }
}
