import { DomainEvent } from '@gitspread/domain-primitives';

export class UserEmailChangedEvent extends DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly oldEmail: string,
    public readonly newEmail: string,
  ) {
    super();
  }

  get eventName(): string {
    return 'user.email.changed';
  }
}
