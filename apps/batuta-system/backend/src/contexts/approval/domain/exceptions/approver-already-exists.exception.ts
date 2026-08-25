import { DomainException } from '@gitspread/domain-primitives';

export class ApproverAlreadyExistsException extends DomainException {
  constructor() {
    super('Já existe um aprovador com este e-mail nesta conta.');
  }
}
