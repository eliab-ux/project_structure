import { DomainException } from '@gitspread/domain-primitives';

export class InvalidTargetFilterException extends DomainException {
  constructor(detail: string) {
    super(`Público inválido: ${detail}`);
  }
}
