import { DomainException } from '@gitspread/domain-primitives';

export class ApproverWithoutContactException extends DomainException {
  constructor() {
    super('Aprovador precisa de e-mail ou telefone para receber o link.');
  }
}
