import { DomainException } from '@gitspread/domain-primitives';

export class InvalidHandleException extends DomainException {
  constructor(handle: string) {
    super(`Handle do Instagram inválido: ${handle}`);
  }
}
