import { DomainException } from '@gitspread/domain-primitives';

export class NoActiveApproverException extends DomainException {
  constructor() {
    super(
      'Nenhum aprovador ativo configurado. Cadastre aprovadores antes de enviar para aprovação.',
    );
  }
}
