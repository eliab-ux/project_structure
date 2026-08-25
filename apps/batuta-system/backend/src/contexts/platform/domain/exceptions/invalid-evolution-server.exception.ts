import { DomainException } from '@gitspread/domain-primitives';

export class InvalidEvolutionServerException extends DomainException {
  constructor() {
    super(
      'Servidor Evolution inválido: informe URL (http/https) e apikey juntos, ou ambos vazios ' +
        'para voltar ao servidor compartilhado da plataforma.',
    );
  }
}
