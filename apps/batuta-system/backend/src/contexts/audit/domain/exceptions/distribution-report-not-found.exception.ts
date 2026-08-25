import { DomainException } from '@gitspread/domain-primitives';

export class DistributionReportNotFoundException extends DomainException {
  constructor() {
    super('Distribuição não encontrada para gerar o relatório.');
  }
}
