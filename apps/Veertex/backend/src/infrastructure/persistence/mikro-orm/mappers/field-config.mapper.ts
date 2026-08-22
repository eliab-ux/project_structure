import { Injectable } from '@nestjs/common';
import { FieldConfig } from '../../../../contexts/field-config/domain/entities/field-config.entity';
import { FieldConfigOrmEntity } from '../entities/field-config-orm.entity';

@Injectable()
export class FieldConfigMapper {
  toDomain(orm: FieldConfigOrmEntity): FieldConfig {
    return FieldConfig.reconstitute({
      id: orm.id,
      accountId: orm.accountId,
      entity: orm.entity,
      field: orm.field,
      visible: orm.visible,
      required: orm.required,
      label: orm.label,
      sortOrder: orm.sortOrder,
      createdAt: orm.createdAt,
    });
  }
}
