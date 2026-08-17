import { Injectable } from '@nestjs/common';
import { Fabric } from '../../../../contexts/catalog/domain/entities/fabric.entity';
import { ProductType } from '../../../../contexts/catalog/domain/entities/product-type.entity';
import { FabricId } from '../../../../contexts/catalog/domain/value-objects/fabric-id.vo';
import { ProductTypeId } from '../../../../contexts/catalog/domain/value-objects/product-type-id.vo';
import { AccountId } from '../../../../contexts/account/domain/value-objects/account-id.vo';
import { FabricOrmEntity } from '../entities/fabric-orm.entity';
import { ProductTypeOrmEntity } from '../entities/product-type-orm.entity';

@Injectable()
export class FabricMapper {
  toDomain(orm: FabricOrmEntity): Fabric {
    return Fabric.restore({
      id: FabricId.from(orm.id),
      accountId: AccountId.from(orm.accountId),
      name: orm.name,
      // `numeric` chega como string; a conversão acontece só aqui.
      maxLayerHeightCm: Number(orm.maxLayerHeightCm),
      // Nulo continua nulo: `Number(null)` daria 0, que a entidade leria como "sem espessura" de
      // qualquer forma, mas passaria pelo validador como se fosse valor informado.
      layerThicknessCm: orm.layerThicknessCm === null ? null : Number(orm.layerThicknessCm),
      notes: orm.notes,
      createdAt: orm.createdAt,
      updatedAt: orm.updatedAt,
    });
  }

  toOrm(domain: Fabric, target: FabricOrmEntity = new FabricOrmEntity()): FabricOrmEntity {
    target.id = domain.id.value;
    target.accountId = domain.accountId.value;
    target.name = domain.name;
    // `toFixed(2)` para a coluna receber exatamente as duas casas que ela guarda.
    target.maxLayerHeightCm = domain.maxLayerHeightCm.toFixed(2);
    target.layerThicknessCm = domain.layerThicknessCm?.toFixed(3) ?? null;
    target.notes = domain.notes;
    target.createdAt = domain.createdAt;
    target.updatedAt = domain.updatedAt;
    return target;
  }
}

@Injectable()
export class ProductTypeMapper {
  toDomain(orm: ProductTypeOrmEntity): ProductType {
    return ProductType.restore({
      id: ProductTypeId.from(orm.id),
      accountId: AccountId.from(orm.accountId),
      name: orm.name,
      createdAt: orm.createdAt,
      updatedAt: orm.updatedAt,
    });
  }

  toOrm(
    domain: ProductType,
    target: ProductTypeOrmEntity = new ProductTypeOrmEntity(),
  ): ProductTypeOrmEntity {
    target.id = domain.id.value;
    target.accountId = domain.accountId.value;
    target.name = domain.name;
    target.createdAt = domain.createdAt;
    target.updatedAt = domain.updatedAt;
    return target;
  }
}
