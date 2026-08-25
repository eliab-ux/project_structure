import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityManager, EntityRepository } from '@mikro-orm/core';
import {
  MaterialRepositoryPort,
  MaterialFilters,
} from '../../../../contexts/materials/application/ports/output/material-repository.port';
import { Material } from '../../../../contexts/materials/domain/entities/material.entity';
import { MaterialId } from '../../../../contexts/materials/domain/value-objects/material-id.vo';
import { MaterialMapper } from '../mappers/material.mapper';
import { MaterialOrmEntity } from '../entities/material-orm.entity';

@Injectable()
export class MikroOrmMaterialRepository implements MaterialRepositoryPort {
  constructor(
    @InjectRepository(MaterialOrmEntity)
    private readonly repository: EntityRepository<MaterialOrmEntity>,
    private readonly em: EntityManager,
    private readonly mapper: MaterialMapper,
  ) {}

  async save(material: Material): Promise<Material> {
    const orm = this.mapper.toOrm(material);
    await this.em.persistAndFlush(orm);
    return this.mapper.toDomain(orm);
  }

  async findById(id: MaterialId): Promise<Material | null> {
    const orm = await this.repository.findOne({ id: id.value });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async findAll(filters?: MaterialFilters): Promise<Material[]> {
    const where: Record<string, unknown> = {};
    if (filters?.onlyActive) {
      where.isActive = true;
    }

    const ormEntities = await this.repository.find(where, {
      orderBy: { createdAt: 'DESC' },
    });

    return ormEntities.map((orm) => this.mapper.toDomain(orm));
  }

  async delete(id: MaterialId): Promise<void> {
    await this.repository.nativeDelete({ id: id.value });
  }
}
