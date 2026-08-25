import { Injectable } from '@nestjs/common';
import { Reseller } from '../../../../contexts/reseller/domain/entities/reseller.entity';
import { ResellerOrmEntity } from '../entities/reseller-orm.entity';
import { ResellerId } from '../../../../contexts/reseller/domain/value-objects/reseller-id.vo';
import { UniqueLink } from '../../../../contexts/reseller/domain/value-objects/unique-link.vo';
import { CPF } from '../../../../contexts/reseller/domain/value-objects/cpf.vo';
import { ResellerStatus } from '../../../../contexts/reseller/domain/value-objects/reseller-status.vo';
import { ResellerLevel } from '../../../../contexts/reseller/domain/value-objects/reseller-level.vo';

@Injectable()
export class ResellerMapper {
  toDomain(orm: ResellerOrmEntity): Reseller {
    return Reseller.reconstitute(
      ResellerId.from(orm.id),
      orm.userId,
      UniqueLink.from(orm.uniqueLink),
      CPF.create(orm.cpf),
      (orm.type as 'pf' | 'pj') ?? 'pf',
      orm.birthDate || null,
      orm.addressZipCode || null,
      orm.addressStreet || null,
      orm.addressNumber || null,
      orm.addressComplement || null,
      orm.addressNeighborhood || null,
      orm.addressCity || null,
      orm.addressState || null,
      orm.fullName || '',
      ResellerStatus.from(orm.status),
      ResellerLevel.from(orm.level),
      false, // canSetCustomPrice - campo removido do banco, usando valor padrão
      orm.approvedAt || null,
      orm.approvedBy || null,
      orm.rejectedAt || null,
      orm.rejectedReason || null,
      orm.phone || null,
      orm.bankName || null,
      orm.bankCode || null,
      orm.bankAgency || null,
      orm.bankAccount || null,
      orm.bankAccountType || null,
      orm.bankHolderName || null,
      orm.bankHolderCpf || null,
      orm.pixKey || null,
      orm.pixKeyType || null,
      orm.suspendedAt || null,
      orm.suspendedBy || null,
      orm.suspensionReason || null,
      Number(orm.totalSoldYear) || 0,
      orm.createdAt,
      orm.updatedAt,
    );
  }

  toOrm(domain: Reseller): ResellerOrmEntity {
    const orm = new ResellerOrmEntity();
    orm.id = domain.id.value;
    orm.userId = domain.userId;
    orm.uniqueLink = domain.uniqueLink.value;
    orm.cpf = domain.cpf.value;
    orm.type = domain.type;
    orm.birthDate = domain.birthDate ?? undefined;
    orm.addressZipCode = domain.addressZipCode ?? undefined;
    orm.addressStreet = domain.addressStreet ?? undefined;
    orm.addressNumber = domain.addressNumber ?? undefined;
    orm.addressComplement = domain.addressComplement ?? undefined;
    orm.addressNeighborhood = domain.addressNeighborhood ?? undefined;
    orm.addressCity = domain.addressCity ?? undefined;
    orm.addressState = domain.addressState ?? undefined;
    orm.fullName = domain.fullName;
    orm.status = domain.status.value;
    orm.level = domain.level.value;
    // canSetCustomPrice removido - campo não existe no banco de dados
    orm.approvedAt = domain.approvedAt;
    orm.approvedBy = domain.approvedBy;
    orm.rejectedAt = domain.rejectedAt;
    orm.rejectedReason = domain.rejectedReason;
    orm.phone = domain.phone;
    orm.bankName = domain.bankName;
    orm.bankCode = domain.bankCode;
    orm.bankAgency = domain.bankAgency;
    orm.bankAccount = domain.bankAccount;
    orm.bankAccountType = domain.bankAccountType;
    orm.bankHolderName = domain.bankHolderName;
    orm.bankHolderCpf = domain.bankHolderCpf;
    orm.pixKey = domain.pixKey;
    orm.pixKeyType = domain.pixKeyType;
    orm.suspendedAt = domain.suspendedAt;
    orm.suspendedBy = domain.suspendedBy;
    orm.suspensionReason = domain.suspensionReason;
    orm.totalSoldYear = domain.totalSoldYear;
    orm.createdAt = domain.createdAt;
    orm.updatedAt = domain.updatedAt;
    return orm;
  }
}
