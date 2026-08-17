import { DomainException } from '@gitspread/domain-primitives';

/**
 * O e-mail é o login e é único no sistema inteiro, não por conta — sem isso o login por
 * e-mail + senha não teria como decidir em qual conta autenticar.
 *
 * A mensagem assume que quem a lê é o Administrativo cadastrando a própria equipe, que já sabe
 * quais e-mails existem na casa dele. Esta exceção nunca é levantada num caminho anônimo.
 */
export class EmailAlreadyInUseException extends DomainException {
  constructor() {
    super('Já existe um usuário com este e-mail.');
  }
}
