import { DomainException } from '@gitspread/domain-primitives';

export class WatchedAccountNotFoundException extends DomainException {
  constructor(identifier: string) {
    super(`Conta monitorada não encontrada: ${identifier}`);
  }
}
