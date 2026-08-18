import { Injectable } from '@nestjs/common';
import { Account } from '../../../../contexts/account/domain/entities/account.entity';
import { AccountId } from '../../../../contexts/account/domain/value-objects/account-id.vo';
import { ReportOwner } from '../../../../contexts/account/domain/value-objects/report-owner.vo';
import { AccountOrmEntity } from '../entities/account-orm.entity';

@Injectable()
export class AccountMapper {
  toDomain(orm: AccountOrmEntity): Account {
    return Account.restore({
      id: AccountId.from(orm.id),
      name: orm.name,
      city: orm.city,
      timezone: orm.timezone,
      // O responsável é um bloco: sem nome, não há responsável — as outras três colunas sozinhas
      // não formam ninguém.
      reportOwner: orm.reportOwnerName
        ? ReportOwner.create({
            name: orm.reportOwnerName,
            role: orm.reportOwnerRole,
            phone: orm.reportOwnerPhone,
            email: orm.reportOwnerEmail,
          })
        : null,
      createdAt: orm.createdAt,
      updatedAt: orm.updatedAt,
    });
  }

  /** Escreve sobre a instância gerenciada quando ela existe, para o EntityManager ver o UPDATE. */
  toOrm(domain: Account, target: AccountOrmEntity = new AccountOrmEntity()): AccountOrmEntity {
    target.id = domain.id.value;
    target.name = domain.name;
    target.city = domain.city;
    target.timezone = domain.timezone;

    const owner = domain.reportOwner;
    target.reportOwnerName = owner?.name ?? null;
    target.reportOwnerRole = owner?.role ?? null;
    target.reportOwnerPhone = owner?.phone?.value ?? null;
    target.reportOwnerEmail = owner?.email?.value ?? null;

    target.createdAt = domain.createdAt;
    target.updatedAt = domain.updatedAt;
    return target;
  }
}
