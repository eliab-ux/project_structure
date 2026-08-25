import { DomainException } from '@gitspread/domain-primitives';

export class InvalidDistributionWindowException extends DomainException {
  constructor(detail: string) {
    super(`Janela de distribuição inválida: ${detail}`);
  }
}
