import { DomainException } from '@gitspread/domain-primitives';
import { ChannelStatus } from '../../../channel/domain/value-objects/channel-status.vo';

/**
 * Blocks the mistake §6.4 item 1 exists to prevent.
 *
 * The message explains WHY rather than just refusing, because the operator staring at a chip that
 * will not send genuinely believes migrating is the fix — and "migrar 100 contatos porque alguém
 * deixou o celular sem bateria é irreversível na prática".
 */
export class MigrationNotEligibleException extends DomainException {
  constructor(status: ChannelStatus) {
    super(
      `Canal em ${status} não habilita migração de remetente. ` +
        'Desconexão é transitória: religue o chip ou pareie novamente. ' +
        'A migração só existe para canal BANIDO ou APOSENTADO, e é irreversível.',
    );
  }
}

/** ALL_TO_ONE without a destination, or a destination that cannot receive. */
export class InvalidMigrationTargetException extends DomainException {
  constructor(message = 'Canal de destino inválido para a migração.') {
    super(message);
  }
}
