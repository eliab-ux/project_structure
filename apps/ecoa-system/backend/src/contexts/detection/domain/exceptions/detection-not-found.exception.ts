import { DomainException } from '@gitspread/domain-primitives';

export class DetectionNotFoundException extends DomainException {
  constructor(identifier: string) {
    super(`Detecção não encontrada: ${identifier}`);
  }
}
