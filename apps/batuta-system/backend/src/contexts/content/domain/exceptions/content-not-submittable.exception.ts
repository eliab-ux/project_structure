import { DomainException } from '@gitspread/domain-primitives';

export class ContentNotSubmittableException extends DomainException {
  constructor() {
    super('Só um conteúdo em rascunho pode ser enviado para aprovação.');
  }
}
