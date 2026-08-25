import { DomainException } from '@gitspread/domain-primitives';

export class DistributionNotFoundException extends DomainException {
  constructor() {
    super('Distribuição não encontrada.');
  }
}
