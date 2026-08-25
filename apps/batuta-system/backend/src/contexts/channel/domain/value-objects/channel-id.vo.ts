import { randomUUID } from 'crypto';
import { ValueObject } from '@gitspread/domain-primitives';
import { ValidationUtil } from '@gitspread/shared-kernel';
import { InvalidChannelIdException } from '../exceptions/invalid-channel-id.exception';

export class ChannelId extends ValueObject<{ value: string }> {
  private constructor(props: { value: string }) {
    super(props);
    if (!ValidationUtil.isUUID(props.value)) {
      throw new InvalidChannelIdException();
    }
  }

  static generate(): ChannelId {
    return new ChannelId({ value: randomUUID() });
  }

  static from(value: string): ChannelId {
    return new ChannelId({ value });
  }

  get value(): string {
    return this.props.value;
  }
}
