import { DomainException } from '@gitspread/domain-primitives';

export class ApprovalRequestNotFoundException extends DomainException {
  constructor() {
    super('Solicitação de aprovação não encontrada.');
  }
}
