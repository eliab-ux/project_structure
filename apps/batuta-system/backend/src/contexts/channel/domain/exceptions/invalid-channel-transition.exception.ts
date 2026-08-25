import { DomainException } from '@gitspread/domain-primitives';
import { ChannelStatus } from '../value-objects/channel-status.vo';

export class InvalidChannelTransitionException extends DomainException {
  constructor(from: ChannelStatus, to: ChannelStatus) {
    super(`Transição de canal inválida: ${from} → ${to}.`);
  }
}

/**
 * Raised when something tries to operate a channel that is BANNED or RETIRED. Terminal means
 * terminal: there is no un-retire, no un-ban, and no send.
 */
export class ChannelInTerminalStateException extends DomainException {
  constructor(status: ChannelStatus) {
    super(
      `Canal em estado terminal (${status}) não pode mais ser operado. ` +
        'Crie um novo canal e migre os contatos.',
    );
  }
}

/**
 * Raised when an automatic routine tries to declare a terminal state. This is a programming
 * error, not a business outcome — BANNED and RETIRED come only from a human (§4).
 */
export class TerminalStateRequiresHumanException extends DomainException {
  constructor() {
    super('Estado terminal (BANNED/RETIRED) só pode ser declarado por uma pessoa.');
  }
}
