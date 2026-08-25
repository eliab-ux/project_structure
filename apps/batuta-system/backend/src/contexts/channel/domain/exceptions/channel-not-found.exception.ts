import { DomainException } from '@gitspread/domain-primitives';

export class ChannelNotFoundException extends DomainException {
  constructor() {
    super('Canal não encontrado.');
  }
}
