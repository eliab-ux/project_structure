import { DomainException } from '@gitspread/domain-primitives';

export class ApprovalSettingsNotFoundException extends DomainException {
  constructor() {
    super('Configuração de aprovação não encontrada.');
  }
}
