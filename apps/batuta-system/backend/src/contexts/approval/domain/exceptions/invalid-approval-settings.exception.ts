import { DomainException } from '@gitspread/domain-primitives';

export class InvalidApprovalSettingsException extends DomainException {
  constructor() {
    // 8 item 1 sets the ceiling at two: "1 ou 2 aprovadores".
    super('Número de aprovações deve ser 1 ou 2.');
  }
}
