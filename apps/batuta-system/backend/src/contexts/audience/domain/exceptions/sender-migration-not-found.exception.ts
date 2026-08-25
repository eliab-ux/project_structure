import { DomainException } from '@gitspread/domain-primitives';

export class SenderMigrationNotFoundException extends DomainException {
  constructor() {
    super('Migração de remetente não encontrada.');
  }
}
