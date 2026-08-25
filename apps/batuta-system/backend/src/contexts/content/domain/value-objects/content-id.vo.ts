import { randomUUID } from 'crypto';
import { ValueObject } from '@gitspread/domain-primitives';
import { ValidationUtil } from '@gitspread/shared-kernel';
import { InvalidContentIdException } from '../exceptions/invalid-content-id.exception';

export class ContentId extends ValueObject<{ value: string }> {
  private constructor(props: { value: string }) {
    super(props);
    if (!ValidationUtil.isUUID(props.value)) {
      throw new InvalidContentIdException();
    }
  }

  static generate(): ContentId {
    return new ContentId({ value: randomUUID() });
  }

  static from(value: string): ContentId {
    return new ContentId({ value });
  }

  get value(): string {
    return this.props.value;
  }
}
