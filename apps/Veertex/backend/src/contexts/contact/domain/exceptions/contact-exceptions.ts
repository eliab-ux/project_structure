import { DomainException } from '@veertex/domain-primitives';

export class ContactNotFoundException extends DomainException {
  constructor(id: string) {
    // Sem o id na mensagem ao cliente? Não: o id só é conhecido por quem já tem acesso à conta, e o
    // escopo de tenant garante que um id de outra conta responde "não encontrado" do mesmo jeito.
    super(`Contato ${id} não encontrado.`);
  }
}

/**
 * Documento repetido na mesma conta.
 *
 * O §3.4 prevê que "permitir CPF/CNPJ duplicado" seja **preferência da conta**. A preferência não
 * existe ainda, e o default foi decidido por Eliab em 14/08/2026: **não permitir**. É o
 * comportamento conservador — dois cadastros com o mesmo CNPJ é o começo de duas verdades sobre o
 * mesmo cliente, e desfazer isso depois exige mesclar histórico.
 *
 * Quando a preferência existir, esta exceção passa a ser condicional. Enquanto não existir, ela é
 * incondicional **e está escrita**, que é a diferença entre decisão e default silencioso.
 */
export class DuplicateContactDocumentException extends DomainException {
  constructor(document: string) {
    super(`Já existe um contato com o documento ${document} nesta conta.`);
  }
}

export class DuplicateContactCodeException extends DomainException {
  constructor(code: string) {
    super(`Já existe um contato com o código ${code} nesta conta.`);
  }
}

/** Pessoa física com CNPJ, ou jurídica com CPF — o documento tem de casar com o tipo de pessoa. */
export class DocumentKindMismatchException extends DomainException {
  constructor(message: string) {
    super(message);
  }
}

export class InvalidCreditLimitException extends DomainException {}
