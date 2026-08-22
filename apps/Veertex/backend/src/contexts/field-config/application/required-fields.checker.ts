import { Inject, Injectable } from '@nestjs/common';
import {
  FIELD_CONFIG_REPOSITORY,
  FieldConfigRepositoryPort,
} from './ports/output/field-config-repository.port';
import { mergeEffectiveFields } from '../domain/effective-field';
import { catalogFor } from '../domain/field-catalog.registry';
import { RequiredFieldMissingException } from '../domain/exceptions/field-config-exceptions';

/**
 * A validação dinâmica de obrigatoriedade do §3.6 / critério §7.5: *"field_config marca campo
 * obrigatório → API rejeita payload sem ele"*.
 *
 * ## Por que aqui (application), e não num pipe de HTTP
 *
 * O §3.6 sugere "pipe/validator custom". A checagem ficou no caminho do use case, e não num pipe,
 * por três razões concretas deste projeto:
 *
 *  1. **Testabilidade** — a suíte testa use cases com repositório mockado (ADR-0003 / estratégia de
 *     testes). Um pipe leria o EntityManager forkado dentro da transação do interceptor, que é
 *     exatamente o acoplamento que o teste de use case evita.
 *  2. **Camada certa** — "campo obrigatório para ESTA conta" é regra de negócio configurável, não
 *     validação de shape do DTO. Regra de negócio mora no use case (CLAUDE.md).
 *  3. **Mesma fonte que a leitura** — usa o mesmo `mergeEffectiveFields` que o `GET field-catalog`,
 *     então o que a tela mostra como obrigatório é exatamente o que a API exige. Uma segunda
 *     implementação num pipe poderia divergir (a regra 1 das "regras aprendidas com defeito real").
 *
 * O `class-validator` do DTO continua responsável pelo que é ESTÁTICO (tipo, tamanho, formato). Este
 * serviço cobre só o obrigatório DINÂMICO, que o DTO não pode conhecer.
 */
@Injectable()
export class RequiredFieldsChecker {
  constructor(
    @Inject(FIELD_CONFIG_REPOSITORY)
    private readonly repository: FieldConfigRepositoryPort,
  ) {}

  /**
   * Recusa o payload que não traz um campo marcado obrigatório para a conta.
   *
   * @param mode `create` exige todo campo obrigatório presente e não-vazio. `update` só cobra os
   *   campos que o payload MENCIONA (chave presente): um obrigatório ausente na edição significa
   *   "não mexa", e o valor anterior permanece — cobrar aqui rejeitaria toda edição parcial.
   */
  async assertRequiredPresent(
    entity: string,
    payload: Record<string, unknown>,
    mode: 'create' | 'update',
  ): Promise<void> {
    if (!catalogFor(entity)) {
      return; // Entidade não configurável não tem obrigatório dinâmico a cobrar.
    }

    const effective = mergeEffectiveFields(entity, await this.repository.findByEntity(entity));
    const missing: string[] = [];

    for (const field of effective) {
      if (!field.required) {
        continue;
      }
      const mentioned = Object.prototype.hasOwnProperty.call(payload, field.field);
      if (mode === 'update' && !mentioned) {
        continue;
      }
      if (isEmpty(payload[field.field])) {
        missing.push(field.label);
      }
    }

    if (missing.length > 0) {
      throw new RequiredFieldMissingException(entity, missing);
    }
  }
}

/** Vazio = ausente para efeito de obrigatoriedade: null, undefined, string em branco, array vazio. */
function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }
  if (typeof value === 'string') {
    return value.trim().length === 0;
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  return false;
}
