import { Injectable } from '@nestjs/common';
import { Material } from '@contexts/materials/domain/entities/material.entity';
import { MaterialOrmEntity } from '../entities/material-orm.entity';
import { MaterialId } from '@contexts/materials/domain/value-objects/material-id.vo';
import { MaterialType } from '@contexts/materials/domain/value-objects/material-type.vo';

@Injectable()
export class MaterialMapper {
  toDomain(orm: MaterialOrmEntity): Material {
    return Material.reconstitute(
      MaterialId.from(orm.id),
      orm.title,
      orm.description ?? '',
      MaterialType.from(orm.type),
      orm.fileUrl,
      orm.thumbnailUrl ?? null,
      orm.isActive,
      orm.createdAt,
      orm.updatedAt,
    );
  }

  toOrm(domain: Material): MaterialOrmEntity {
    const orm = new MaterialOrmEntity();
    orm.id = domain.id.value;
    orm.title = domain.title;
    orm.description = domain.description;
    orm.type = domain.type.value;
    orm.fileUrl = domain.fileUrl;
    orm.thumbnailUrl = domain.thumbnailUrl ?? undefined;
    orm.isActive = domain.isActive;
    orm.createdAt = domain.createdAt;
    orm.updatedAt = domain.updatedAt;
    return orm;
  }
}
