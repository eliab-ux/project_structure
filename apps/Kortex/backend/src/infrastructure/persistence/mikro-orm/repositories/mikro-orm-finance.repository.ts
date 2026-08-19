import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/core';
import {
  AccountBalance,
  BankAccountRepositoryPort,
  CashEntryRepositoryPort,
  DreLine,
  FinancialCategoryRepositoryPort,
  ReservationRef,
} from '../../../../contexts/finance/application/ports/output/finance-repository.port';
import { BankAccount } from '../../../../contexts/finance/domain/entities/bank-account.entity';
import { FinancialCategory } from '../../../../contexts/finance/domain/entities/financial-category.entity';
import { CashEntry } from '../../../../contexts/finance/domain/entities/cash-entry.entity';
import {
  BankAccountId,
  CashEntryId,
  FinancialCategoryId,
} from '../../../../contexts/finance/domain/value-objects/finance-ids.vo';
import { AccountId } from '../../../../contexts/account/domain/value-objects/account-id.vo';
import { ReservationId } from '../../../../contexts/schedule/domain/value-objects/reservation-id.vo';
import { BankAccountOrmEntity } from '../entities/bank-account-orm.entity';
import { FinancialCategoryOrmEntity } from '../entities/financial-category-orm.entity';
import { CashEntryOrmEntity } from '../entities/cash-entry-orm.entity';
import {
  BankAccountMapper,
  CashEntryMapper,
  FinancialCategoryMapper,
} from '../mappers/finance.mapper';

/** `occurred_on` é coluna `date`: comparação por dia, sem hora e sem fuso. */
function day(date: Date): string {
  return date.toISOString().slice(0, 10);
}

@Injectable()
export class MikroOrmBankAccountRepository implements BankAccountRepositoryPort {
  constructor(
    @InjectRepository(BankAccountOrmEntity)
    private readonly repo: EntityRepository<BankAccountOrmEntity>,
    private readonly em: EntityManager,
    private readonly mapper: BankAccountMapper,
  ) {}

  async listByAccount(accountId: AccountId): Promise<BankAccount[]> {
    const rows = await this.repo.find({ accountId: accountId.value }, { orderBy: { name: 'ASC' } });
    return rows.map((row) => this.mapper.toDomain(row));
  }

  async findById(accountId: AccountId, id: BankAccountId): Promise<BankAccount | null> {
    const orm = await this.repo.findOne({ accountId: accountId.value, id: id.value });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async save(bankAccount: BankAccount): Promise<BankAccount> {
    const existing = await this.repo.findOne({
      accountId: bankAccount.accountId.value,
      id: bankAccount.id.value,
    });
    const orm = this.mapper.toOrm(bankAccount, existing ?? undefined);
    await this.em.persistAndFlush(orm);
    return this.mapper.toDomain(orm);
  }
}

@Injectable()
export class MikroOrmFinancialCategoryRepository implements FinancialCategoryRepositoryPort {
  constructor(
    @InjectRepository(FinancialCategoryOrmEntity)
    private readonly repo: EntityRepository<FinancialCategoryOrmEntity>,
    private readonly em: EntityManager,
    private readonly mapper: FinancialCategoryMapper,
  ) {}

  async listByAccount(accountId: AccountId): Promise<FinancialCategory[]> {
    const rows = await this.repo.find(
      { accountId: accountId.value },
      { orderBy: { direction: 'ASC', name: 'ASC' } },
    );
    return rows.map((row) => this.mapper.toDomain(row));
  }

  async findById(accountId: AccountId, id: FinancialCategoryId): Promise<FinancialCategory | null> {
    const orm = await this.repo.findOne({ accountId: accountId.value, id: id.value });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async findByName(
    accountId: AccountId,
    name: string,
    direction: string,
  ): Promise<FinancialCategory | null> {
    const orm = await this.repo.findOne({ accountId: accountId.value, name, direction });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async save(category: FinancialCategory): Promise<FinancialCategory> {
    const existing = await this.repo.findOne({
      accountId: category.accountId.value,
      id: category.id.value,
    });
    const orm = this.mapper.toOrm(category, existing ?? undefined);
    await this.em.persistAndFlush(orm);
    return this.mapper.toDomain(orm);
  }
}

@Injectable()
export class MikroOrmCashEntryRepository implements CashEntryRepositoryPort {
  constructor(
    @InjectRepository(CashEntryOrmEntity)
    private readonly repo: EntityRepository<CashEntryOrmEntity>,
    private readonly em: EntityManager,
    private readonly mapper: CashEntryMapper,
  ) {}

  async listByPeriod(
    accountId: AccountId,
    from: Date,
    to: Date,
    bankAccountId?: BankAccountId | null,
  ): Promise<CashEntry[]> {
    const rows = await this.repo.find(
      {
        accountId: accountId.value,
        occurredOn: { $gte: day(from), $lte: day(to) },
        // A transferência aparece nas duas contas: filtra pelas duas pontas.
        ...(bankAccountId
          ? {
              $or: [
                { bankAccountId: bankAccountId.value },
                { counterpartAccountId: bankAccountId.value },
              ],
            }
          : {}),
      },
      { orderBy: { occurredOn: 'DESC', createdAt: 'DESC' } },
    );
    return rows.map((row) => this.mapper.toDomain(row));
  }

  async findById(accountId: AccountId, id: CashEntryId): Promise<CashEntry | null> {
    const orm = await this.repo.findOne({ accountId: accountId.value, id: id.value });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async findLiveByReservation(
    accountId: AccountId,
    reservationId: ReservationId,
  ): Promise<CashEntry | null> {
    const orm = await this.repo.findOne({
      accountId: accountId.value,
      reservationId: reservationId.value,
      cancelledAt: null,
    });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async save(entry: CashEntry): Promise<CashEntry> {
    const existing = await this.repo.findOne({
      accountId: entry.accountId.value,
      id: entry.id.value,
    });
    const orm = this.mapper.toOrm(entry, existing ?? undefined);
    await this.em.persistAndFlush(orm);
    return this.mapper.toDomain(orm);
  }

  /**
   * DRE de caixa por categoria (§4.16). Agregação no banco, parametrizada, com `account_id = ?`
   * inline no `where` — o verificador `check:tenant-scope` também lê SQL cru.
   *
   * As duas exclusões que definem o relatório estão no `where`, não em `filter` depois:
   * `type <> 'transfer'` (dinheiro que só trocou de bolso não é receita nem despesa) e
   * `cancelled_at is null` (o cancelado continua consultável, mas fora do resultado).
   */
  async dre(accountId: AccountId, from: Date, to: Date): Promise<DreLine[]> {
    const result = await this.em.getKnex().raw(
      `select
         e.category_id                as category_id,
         c.name                       as category_name,
         e.type                       as direction,
         sum(e.amount_cents)::bigint  as total_cents
       from "cash_entry" e
       join "financial_category" c on c.id = e.category_id
       where e.account_id = ?
         and e.occurred_on between ? ::date and ? ::date
         and e.type <> 'transfer'
         and e.cancelled_at is null
       group by e.category_id, c.name, e.type
       order by e.type asc, c.name asc`,
      [accountId.value, day(from), day(to)],
    );

    return (result.rows ?? []).map((row: Record<string, unknown>) => ({
      categoryId: String(row.category_id),
      categoryName: String(row.category_name),
      direction: row.direction as 'in' | 'out',
      totalCents: Number(row.total_cents),
    }));
  }

  /**
   * Saldo por conta até a data: inicial + entradas + transferências recebidas − saídas − enviadas.
   *
   * A transferência **não** entra no DRE mas move as duas contas: por isso ela é somada aqui pelas
   * duas pontas (`bank_account_id` sai, `counterpart_account_id` recebe). Cancelado não conta.
   * `left join` para a conta sem nenhum lançamento aparecer com o saldo inicial em vez de sumir.
   */
  async balances(accountId: AccountId, until: Date): Promise<AccountBalance[]> {
    const result = await this.em.getKnex().raw(
      `select
         b.id                      as bank_account_id,
         b.name                    as name,
         b.opening_balance_cents   as opening_balance_cents,
         coalesce(sum(case when e.type = 'in' and e.bank_account_id = b.id
                           then e.amount_cents end), 0)::bigint as in_cents,
         coalesce(sum(case when e.type = 'out' and e.bank_account_id = b.id
                           then e.amount_cents end), 0)::bigint as out_cents,
         coalesce(sum(case when e.type = 'transfer' and e.counterpart_account_id = b.id
                           then e.amount_cents end), 0)::bigint as transfer_in_cents,
         coalesce(sum(case when e.type = 'transfer' and e.bank_account_id = b.id
                           then e.amount_cents end), 0)::bigint as transfer_out_cents
       from "bank_account" b
       left join "cash_entry" e
         on e.account_id = b.account_id
        and (e.bank_account_id = b.id or e.counterpart_account_id = b.id)
        and e.occurred_on <= ? ::date
        and e.cancelled_at is null
       where b.account_id = ?
       group by b.id, b.name, b.opening_balance_cents
       order by b.name asc`,
      [day(until), accountId.value],
    );

    return (result.rows ?? []).map((row: Record<string, unknown>) => {
      const opening = Number(row.opening_balance_cents);
      const inCents = Number(row.in_cents);
      const outCents = Number(row.out_cents);
      const transferInCents = Number(row.transfer_in_cents);
      const transferOutCents = Number(row.transfer_out_cents);
      return {
        bankAccountId: String(row.bank_account_id),
        name: String(row.name),
        openingBalanceCents: opening,
        inCents,
        outCents,
        transferInCents,
        transferOutCents,
        balanceCents: opening + inCents + transferInCents - outCents - transferOutCents,
      };
    });
  }

  /**
   * A reserva de cada lançamento — read model para o extrato.
   *
   * Junta na consulta o que a tela mostra junto: cliente, máquina e início da hora vendida. É uma
   * leitura que atravessa contextos de propósito, e o lugar certo para isso é a persistência: o
   * alternativo seria o `FinanceModule` importar o `ScheduleModule`, que já importa o financeiro
   * pelo `CASH_RECORDER` — dois módulos em ciclo por causa de uma linha de tela.
   *
   * `account_id = ?` inline no `where`, como toda consulta do projeto. O `= any(?)` com array
   * parametrizado evita montar `in (...)` por concatenação.
   */
  async reservationRefs(accountId: AccountId, reservationIds: string[]): Promise<ReservationRef[]> {
    if (reservationIds.length === 0) {
      return [];
    }

    const result = await this.em.getKnex().raw(
      `select
         r.id            as reservation_id,
         c.trade_name    as customer_name,
         m.name          as machine_name,
         e.starts_at     as starts_at,
         r.hours         as hours,
         r.total_cents   as total_cents,
         r.status        as status
       from "reservation" r
       join "schedule_entry" e on e.id = r.schedule_entry_id
       join "customer" c on c.id = r.customer_id
       join "machine" m on m.id = r.machine_id
       where r.account_id = ?
         and r.id = any(? ::uuid[])`,
      [accountId.value, reservationIds],
    );

    return (result.rows ?? []).map((row: Record<string, unknown>) => ({
      reservationId: String(row.reservation_id),
      customerName: String(row.customer_name),
      machineName: String(row.machine_name),
      startsAt: new Date(row.starts_at as string).toISOString(),
      hours: Number(row.hours),
      totalCents: Number(row.total_cents),
      status: String(row.status),
    }));
  }
}
