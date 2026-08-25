import { DomainException } from '@gitspread/domain-primitives';

export class ChannelNotConnectedException extends DomainException {
  constructor() {
    super('Canal não está conectado.');
  }
}
