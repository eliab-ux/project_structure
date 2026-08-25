import { DomainException } from '@gitspread/domain-primitives';

export class NoEligibleChannelException extends DomainException {
  constructor() {
    super(
      'Nenhum canal conectado disponível para receber os contatos. Conecte um chip antes de importar.',
    );
  }
}
