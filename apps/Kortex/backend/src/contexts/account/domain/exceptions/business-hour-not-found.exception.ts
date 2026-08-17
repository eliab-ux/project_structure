import { DomainException } from '@gitspread/domain-primitives';

export class BusinessHourNotFoundException extends DomainException {
  constructor() {
    super('Janela de funcionamento não encontrada.');
  }
}
