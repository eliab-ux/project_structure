import { randomUUID } from 'crypto';
import { ValueObject } from '@gitspread/domain-primitives';
import { ValidationUtil } from '@gitspread/shared-kernel';
import { InvalidContactIdException } from '../exceptions/invalid-contact-id.exception';

export class ContactId extends ValueObject<{ value: string }> {
  private constructor(props: { value: string }) {
    super(props);
    if (!ValidationUtil.isUUID(props.value)) {
      throw new InvalidContactIdException();
    }
  }

  static generate(): ContactId {
    return new ContactId({ value: randomUUID() });
  }

  static from(value: string): ContactId {
    return new ContactId({ value });
  }

  get value(): string {
    return this.props.value;
  }
}
