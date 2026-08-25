import { DomainException } from '@gitspread/domain-primitives';

export class WatchedAccountAlreadyExistsException extends DomainException {
  constructor(handle: string) {
    super(`Esta conta já está sendo monitorada: @${handle}`);
  }
}
