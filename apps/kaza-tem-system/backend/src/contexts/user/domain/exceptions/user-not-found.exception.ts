import { DomainException } from '@gitspread/domain-primitives';

export class UserNotFoundException extends DomainException {
  constructor(identifier: string) {
    super(`User not found: ${identifier}`);
  }
}
