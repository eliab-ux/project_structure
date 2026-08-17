import { Injectable } from '@nestjs/common';
import { Cut } from '../../../../contexts/cut/domain/entities/cut.entity';
import { CutId } from '../../../../contexts/cut/domain/value-objects/cut-id.vo';
import { AccountId } from '../../../../contexts/account/domain/value-objects/account-id.vo';
import { FabricId } from '../../../../contexts/catalog/domain/value-objects/fabric-id.vo';
import { ProductTypeId } from '../../../../contexts/catalog/domain/value-objects/product-type-id.vo';
import { ReservationId } from '../../../../contexts/schedule/domain/value-objects/reservation-id.vo';
import { LayoutType } from '../../../../shared/domain/value-objects/layout-type';
import { CutOrmEntity } from '../entities/cut-orm.entity';

@Injectable()
export class CutMapper {
  toDomain(orm: CutOrmEntity): Cut {
    return Cut.restore({
      id: CutId.from(orm.id),
      accountId: AccountId.from(orm.accountId),
      reservationId: ReservationId.from(orm.reservationId),
      sequence: orm.sequence,
      markerName: orm.markerName,
      startedAt: orm.startedAt,
      endedAt: orm.endedAt,
      layers: orm.layers,
      nestedPieces: orm.nestedPieces,
      layoutType: orm.layoutType as LayoutType | null,
      fabricId: FabricId.from(orm.fabricId),
      productTypeId: ProductTypeId.from(orm.productTypeId),
      createdAt: orm.createdAt,
      updatedAt: orm.updatedAt,
    });
  }

  toOrm(domain: Cut, target: CutOrmEntity = new CutOrmEntity()): CutOrmEntity {
    target.id = domain.id.value;
    target.accountId = domain.accountId.value;
    target.reservationId = domain.reservationId.value;
    target.sequence = domain.sequence;
    target.markerName = domain.markerName;
    target.startedAt = domain.startedAt;
    target.endedAt = domain.endedAt;
    target.layers = domain.layers;
    target.nestedPieces = domain.nestedPieces;
    // Sempre o derivado do domínio — nunca um valor que veio de fora.
    target.totalPieces = domain.totalPieces;
    target.layoutType = domain.layoutType;
    target.fabricId = domain.fabricId.value;
    target.productTypeId = domain.productTypeId.value;
    target.createdAt = domain.createdAt;
    target.updatedAt = domain.updatedAt;
    // machine_cut_* não são tocados aqui: são do import da fase 7.
    return target;
  }
}
