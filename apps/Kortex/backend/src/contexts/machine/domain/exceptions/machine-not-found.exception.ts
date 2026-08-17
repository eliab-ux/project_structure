import { DomainException } from '@gitspread/domain-primitives';

export class MachineNotFoundException extends DomainException {
  constructor() {
    super('Máquina não encontrada.');
  }
}
