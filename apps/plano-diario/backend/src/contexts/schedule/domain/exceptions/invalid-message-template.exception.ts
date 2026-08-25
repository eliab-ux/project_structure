import { DomainException } from '@gitspread/domain-primitives';

export class InvalidMessageTemplateException extends DomainException {
  constructor(reason: string) {
    super(reason);
  }
}
