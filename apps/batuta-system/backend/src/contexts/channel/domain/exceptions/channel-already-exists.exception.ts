import { DomainException } from '@gitspread/domain-primitives';

export class ChannelAlreadyExistsException extends DomainException {
  constructor() {
    super('Já existe um canal com este número nesta conta.');
  }
}
