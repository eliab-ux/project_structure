import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  FIELD_CONFIG_REPOSITORY,
  FieldConfigRepositoryPort,
} from '../../ports/output/field-config-repository.port';
import { mergeEffectiveFields } from '../../../domain/effective-field';
import { catalogFor } from '../../../domain/field-catalog.registry';
import { EntityFieldConfigDto } from '../../dto/field-config.dto';
import { UnknownConfigurableEntityException } from '../../../domain/exceptions/field-config-exceptions';

export class GetFieldConfigQuery {
  constructor(public readonly entity: string) {}
}

/**
 * A configuração efetiva de uma entidade (catálogo mesclado com a config da conta).
 *
 * É o que alimenta tanto a tela de configuração quanto os formulários de Contato/Produto — os dois
 * consomem o MESMO merge, então a tela de edição e a de cadastro nunca discordam sobre o que é
 * visível ou obrigatório.
 */
@Injectable()
export class GetFieldConfigUseCase implements UseCase<GetFieldConfigQuery, EntityFieldConfigDto> {
  constructor(
    @Inject(FIELD_CONFIG_REPOSITORY)
    private readonly repository: FieldConfigRepositoryPort,
  ) {}

  async execute(query: GetFieldConfigQuery): Promise<EntityFieldConfigDto> {
    if (!catalogFor(query.entity)) {
      throw new UnknownConfigurableEntityException(query.entity);
    }
    const configs = await this.repository.findByEntity(query.entity);
    return EntityFieldConfigDto.from(query.entity, mergeEffectiveFields(query.entity, configs));
  }
}
