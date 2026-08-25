import { DomainException } from '@gitspread/domain-primitives';

export class ApproverNotFoundException extends DomainException {
  constructor() {
    super('Aprovador não encontrado.');
  }
}
