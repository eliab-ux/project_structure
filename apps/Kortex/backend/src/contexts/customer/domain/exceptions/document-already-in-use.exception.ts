import { DomainException } from '@gitspread/domain-primitives';

/**
 * Documento repetido dentro da MESMA conta (`customer_account_id_document_unique`). Vira 400.
 *
 * A mensagem **não repete o documento**: CNPJ e CPF não entram em mensagem de erro pelo mesmo
 * motivo que não entram em log (spec §4.4) — a mensagem viaja para a tela, para o log de acesso e
 * para o relatório de erro.
 */
export class DocumentAlreadyInUseException extends DomainException {
  constructor() {
    super('Já existe um cliente com este documento nesta conta.');
  }
}
