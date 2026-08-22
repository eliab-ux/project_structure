import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import {
  FIELD_CONFIG_REPOSITORY,
  FieldConfigRepositoryPort,
} from '../../ports/output/field-config-repository.port';
import { FieldConfig } from '../../../domain/entities/field-config.entity';
import { mergeEffectiveFields } from '../../../domain/effective-field';
import { catalogFor } from '../../../domain/field-catalog.registry';
import { EntityFieldConfigDto } from '../../dto/field-config.dto';
import { UnknownConfigurableEntityException } from '../../../domain/exceptions/field-config-exceptions';

export interface FieldOverrideInput {
  field: string;
  visible: boolean;
  required: boolean;
  label?: string | null;
  order?: number | null;
}

export class SetFieldConfigCommand {
  constructor(
    public readonly accountId: string,
    public readonly entity: string,
    public readonly overrides: readonly FieldOverrideInput[],
  ) {}
}

/**
 * Grava a configuração de campos de uma entidade (`SetFieldConfig` do §4 do CORE).
 *
 * ## Falha na ESCRITA, nunca ignora na leitura (§3.6)
 *
 * Cada override vira uma `FieldConfig`, cujo construtor recusa entidade/campo fora do catálogo e
 * recusa afrouxar campo obrigatório por domínio (DECISÃO 2.1). Um único override inválido derruba a
 * gravação inteira — dentro da transação, então nada é escrito pela metade. É o que impede a config
 * de "criar campo" ou de esconder o que o backend exige.
 *
 * ## DECISÃO 2.2 — por tela, nesta fatia
 *
 * A gravação é por tela (este use case, chamado pelo controller REST). O caminho por INTENÇÃO
 * ("torne o Suframa obrigatório") produziria um rascunho que, aprovado, chamaria este mesmo use
 * case — ele é a fundação, não a alternativa. O caminho por frase fica registrado como recomendação
 * (ver a resposta ao Eliab), não implementado aqui.
 */
@Injectable()
export class SetFieldConfigUseCase implements UseCase<SetFieldConfigCommand, EntityFieldConfigDto> {
  constructor(
    @Inject(FIELD_CONFIG_REPOSITORY)
    private readonly repository: FieldConfigRepositoryPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: SetFieldConfigCommand): Promise<EntityFieldConfigDto> {
    if (!catalogFor(command.entity)) {
      throw new UnknownConfigurableEntityException(command.entity);
    }

    // Construir ANTES da transação: se um override é inválido, a exceção de domínio sobe sem ter
    // aberto escrita nenhuma. A validação vive no construtor da FieldConfig.
    const configs = command.overrides.map((override) =>
      FieldConfig.create({
        accountId: command.accountId,
        entity: command.entity,
        field: override.field,
        visible: override.visible,
        required: override.required,
        label: override.label,
        sortOrder: override.order,
      }),
    );

    return this.uow.execute(async () => {
      await this.repository.replaceEntityConfigs(command.entity, configs);
      return EntityFieldConfigDto.from(
        command.entity,
        mergeEffectiveFields(command.entity, configs),
      );
    });
  }
}
