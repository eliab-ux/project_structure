import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import {
  FinancialTitleRepositoryPort,
  ListTitlesFilter,
} from '../../../../contexts/finance/application/ports/output/financial-title-repository.port';
import { FinancialTitle } from '../../../../contexts/finance/domain/entities/financial-title.entity';
import {
  TitleSettlement,
  SettlementMethod,
} from '../../../../contexts/finance/domain/entities/title-settlement.entity';
import { TitleDirection, TitleOrigin } from '../../../../contexts/finance/domain/title-enums';
import { FinancialTitleOrmEntity } from '../entities/financial-title-orm.entity';
import { TitleSettlementOrmEntity } from '../entities/title-settlement-orm.entity';

/**
 * Repositório de títulos. As baixas são **append-only**: no `save`, só as baixas novas do agregado
 * (as que ainda não têm linha) são inseridas; as existentes nunca são tocadas. O `status` derivado é
 * persistido no header para a listagem filtrar.
 */
@Injectable()
export class MikroOrmFinancialTitleRepository implements FinancialTitleRepositoryPort {
  constructor(private readonly em: EntityManager) {}

  private toDomain(orm: FinancialTitleOrmEntity): FinancialTitle {
    const settlements = orm.settlements.getItems().map((s) =>
      TitleSettlement.create({
        id: s.id,
        financialAccountId: s.financialAccountId,
        method: s.method as SettlementMethod,
        principal: Number(s.principal),
        interest: Number(s.interest),
        fine: Number(s.fine),
        discount: Number(s.discount),
        settledAt: s.settledAt,
      }),
    );
    return FinancialTitle.reconstitute({
      id: orm.id,
      accountId: orm.accountId,
      companyId: orm.companyId,
      direction: orm.direction as TitleDirection,
      contactId: orm.contactId,
      categoryId: orm.categoryId,
      description: orm.description,
      amount: Number(orm.amount),
      issueDate: orm.issueDate,
      dueDate: orm.dueDate,
      origin: orm.origin as TitleOrigin,
      settlements,
      // A sinalização persistida volta ao agregado; open/partial/settled são derivados das baixas.
      flaggedStatus: ['renegotiated', 'written_off_pending', 'written_off'].includes(orm.status)
        ? orm.status
        : null,
      createdAt: orm.createdAt,
    });
  }

  async findById(id: string): Promise<FinancialTitle | null> {
    const orm = await this.em.findOne(
      FinancialTitleOrmEntity,
      { id },
      { populate: ['settlements'] },
    );
    return orm ? this.toDomain(orm) : null;
  }

  async list(filter: ListTitlesFilter): Promise<FinancialTitle[]> {
    const rows = await this.em.find(
      FinancialTitleOrmEntity,
      {
        ...(filter.direction ? { direction: filter.direction } : {}),
        ...(filter.companyId ? { companyId: filter.companyId } : {}),
        ...(filter.contactId ? { contactId: filter.contactId } : {}),
        ...(filter.status ? { status: filter.status } : {}),
      },
      { populate: ['settlements'], orderBy: { dueDate: 'ASC' } },
    );
    return rows.map((row) => this.toDomain(row));
  }

  async save(title: FinancialTitle): Promise<FinancialTitle> {
    let orm: FinancialTitleOrmEntity | null = await this.em.findOne(
      FinancialTitleOrmEntity,
      { id: title.id },
      { populate: ['settlements'] },
    );

    if (!orm) {
      orm = this.em.create(FinancialTitleOrmEntity, {
        id: title.id,
        accountId: title.accountId,
        direction: title.direction,
        companyId: title.companyId,
        contactId: title.contactId,
        categoryId: title.categoryId,
        description: title.description,
        amount: title.amount.toFixed(2),
        issueDate: title.issueDate,
        dueDate: title.dueDate,
        origin: title.origin,
        status: title.status,
        createdAt: title.createdAt,
        updatedAt: new Date(),
      });
      this.em.persist(orm);
    } else {
      orm.contactId = title.contactId;
      orm.categoryId = title.categoryId;
      orm.description = title.description;
      orm.dueDate = title.dueDate;
      orm.status = title.status;
      orm.updatedAt = new Date();
      if (!orm.settlements.isInitialized()) {
        await this.em.populate(orm, ['settlements']);
      }
    }

    // Append-only: só insere baixas que ainda não têm linha.
    const persistedIds = new Set(orm.settlements.getItems().map((s) => s.id));
    const now = new Date();
    for (const settlement of title.settlements) {
      if (persistedIds.has(settlement.id)) {
        continue;
      }
      orm.settlements.add(
        this.em.create(TitleSettlementOrmEntity, {
          id: settlement.id,
          accountId: title.accountId,
          title: orm,
          financialAccountId: settlement.financialAccountId,
          method: settlement.method,
          principal: settlement.principal.toFixed(2),
          interest: settlement.interest.toFixed(2),
          fine: settlement.fine.toFixed(2),
          discount: settlement.discount.toFixed(2),
          settledAt: settlement.settledAt,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        }),
      );
    }

    await this.em.flush();
    return this.toDomain(orm);
  }
}
