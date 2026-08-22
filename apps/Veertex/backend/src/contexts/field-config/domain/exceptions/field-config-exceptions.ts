import { DomainException } from '@gitspread/domain-primitives';

/**
 * Entidade fora do catálogo — recusada na ESCRITA.
 *
 * É metade do invariante do §3.6 ("a config nunca cria campo"): se `entity` nem existe no registro,
 * não há catálogo contra o qual validar os campos, e aceitar a linha seria guardar configuração de
 * uma entidade imaginária. Cobre também `order`, que o §3.6 lista mas cujo contexto ainda não nasceu.
 */
export class UnknownConfigurableEntityException extends DomainException {
  constructor(entity: string) {
    super(`Entidade "${entity}" não tem campos configuráveis.`);
  }
}

/**
 * Campo fora do catálogo da entidade — recusado na ESCRITA (a outra metade do invariante do §3.6).
 *
 * "Falha na escrita, não é ignorado na leitura": um `field_config` para um campo inexistente
 * passaria despercebido numa leitura tolerante e viraria lixo que ninguém explica. Recusar aqui é o
 * que impede a config de inventar campo.
 */
export class UnknownConfigurableFieldException extends DomainException {
  constructor(entity: string, field: string) {
    super(`O campo "${field}" não existe no catálogo de "${entity}".`);
  }
}

/**
 * Tentativa de ocultar ou tornar opcional um campo exigido pelo domínio (DECISÃO 2.1, recomendação).
 *
 * O catálogo declara `mandatoryByDomain` para os campos que o VO/entidade recusam ausentes. Deixar a
 * config escondê-los faria a tela impedir o cadastro que o backend exige — o formulário recusaria o
 * que só o formulário conseguia preencher. A config alcança rótulo e ordem desses campos, nunca a
 * visibilidade nem a obrigatoriedade.
 */
export class CannotRelaxMandatoryFieldException extends DomainException {
  constructor(entity: string, field: string) {
    super(
      `O campo "${field}" de "${entity}" é obrigatório por regra de negócio: ` +
        'a configuração pode mudar rótulo e ordem, não ocultá-lo nem torná-lo opcional.',
    );
  }
}

/**
 * Payload sem um campo que a config da conta marcou como obrigatório (critério de aceite §7.5).
 *
 * É uma exceção de negócio (→ 400), não uma falha de validação de shape do DTO: o campo existe no
 * DTO e é sintaticamente válido; o que falta é o valor que ESTA conta decidiu exigir. Uma só
 * exceção para o conjunto, com a lista dos campos, para a tela apontar todos de uma vez.
 */
export class RequiredFieldMissingException extends DomainException {
  constructor(entity: string, fields: readonly string[]) {
    super(`Campos obrigatórios não preenchidos em "${entity}": ${fields.join(', ')}.`);
  }
}
