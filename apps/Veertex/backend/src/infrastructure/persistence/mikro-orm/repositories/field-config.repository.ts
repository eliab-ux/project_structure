import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { FieldConfigRepositoryPort } from '../../../../contexts/field-config/application/ports/output/field-config-repository.port';
import { FieldConfig } from '../../../../contexts/field-config/domain/entities/field-config.entity';
import { FieldConfigOrmEntity } from '../entities/field-config-orm.entity';
import { FieldConfigMapper } from '../mappers/field-config.mapper';

/**
 * Repositório de `field_config`.
 *
 * Como nos demais: **nenhum método recebe `accountId`** — o filtro global do MikroORM e a policy de
 * RLS escopam toda leitura e escrita. O `account_id` de cada linha nova vem do agregado (que o
 * recebeu do token, no use case), nunca de parâmetro.
 */
@Injectable()
export class MikroOrmFieldConfigRepository implements FieldConfigRepositoryPort {
  constructor(
    private readonly em: EntityManager,
    private readonly mapper: FieldConfigMapper,
  ) {}

  async findByEntity(entity: string): Promise<FieldConfig[]> {
    const rows = await this.em.find(FieldConfigOrmEntity, { entity });
    return rows.map((row) => this.mapper.toDomain(row));
  }

  async findAll(): Promise<FieldConfig[]> {
    const rows = await this.em.find(FieldConfigOrmEntity, {}, { orderBy: { entity: 'ASC' } });
    return rows.map((row) => this.mapper.toDomain(row));
  }

  /**
   * Substituição por soft-delete + inserção, o mesmo padrão de Contato/Produto: as linhas atuais da
   * entidade saem com `deleted_at` (o papel de runtime não tem DELETE — invariante do
   * `verify:isolation`), as novas entram. Tudo numa transação (o use case abre a UoW).
   *
   * `account_id` é escrito explicitamente por linha: sem ele a coluna iria nula e a policy de RLS
   * recusaria o INSERT — que é o comportamento correto da policy, e o bug seria nosso.
   */
  async replaceEntityConfigs(entity: string, configs: readonly FieldConfig[]): Promise<void> {
    const now = new Date();

    const current = await this.em.find(FieldConfigOrmEntity, { entity });
    for (const row of current) {
      row.deletedAt = now;
    }

    for (const config of configs) {
      this.em.persist(
        this.em.create(FieldConfigOrmEntity, {
          id: config.id,
          accountId: config.accountId,
          entity: config.entity,
          field: config.field,
          visible: config.visible,
          required: config.required,
          label: config.label,
          sortOrder: config.sortOrder,
          createdAt: config.createdAt,
          updatedAt: now,
          deletedAt: null,
        }),
      );
    }

    await this.em.flush();
  }
}
