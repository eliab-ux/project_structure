import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/core';
import {
  CutRepositoryPort,
  FabricHistory,
} from '../../../../contexts/cut/application/ports/output/cut-repository.port';
import { Cut } from '../../../../contexts/cut/domain/entities/cut.entity';
import { CutId } from '../../../../contexts/cut/domain/value-objects/cut-id.vo';
import { AccountId } from '../../../../contexts/account/domain/value-objects/account-id.vo';
import { FabricId } from '../../../../contexts/catalog/domain/value-objects/fabric-id.vo';
import { ReservationId } from '../../../../contexts/schedule/domain/value-objects/reservation-id.vo';
import { CutOrmEntity } from '../entities/cut-orm.entity';
import { CutMapper } from '../mappers/cut.mapper';

/** Recorte de volume comparável: metade a dobro do lote pedido. */
const VOLUME_BAND = { lower: 0.5, upper: 2 };

@Injectable()
export class MikroOrmCutRepository implements CutRepositoryPort {
  constructor(
    @InjectRepository(CutOrmEntity)
    private readonly repo: EntityRepository<CutOrmEntity>,
    private readonly em: EntityManager,
    private readonly mapper: CutMapper,
  ) {}

  async listByReservation(accountId: AccountId, reservationId: ReservationId): Promise<Cut[]> {
    const rows = await this.repo.find(
      { accountId: accountId.value, reservationId: reservationId.value },
      { orderBy: { sequence: 'ASC' } },
    );
    return rows.map((row) => this.mapper.toDomain(row));
  }

  async findById(accountId: AccountId, id: CutId): Promise<Cut | null> {
    const orm = await this.repo.findOne({ accountId: accountId.value, id: id.value });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async findRunning(accountId: AccountId, reservationId: ReservationId): Promise<Cut | null> {
    const orm = await this.repo.findOne({
      accountId: accountId.value,
      reservationId: reservationId.value,
      endedAt: null,
    });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async findRunningInAccount(accountId: AccountId): Promise<Cut | null> {
    const orm = await this.repo.findOne(
      { accountId: accountId.value, endedAt: null },
      { orderBy: { startedAt: 'DESC' } },
    );
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async save(cut: Cut): Promise<Cut> {
    const existing = await this.repo.findOne({
      accountId: cut.accountId.value,
      id: cut.id.value,
    });
    const orm = this.mapper.toOrm(cut, existing ?? undefined);
    await this.em.persistAndFlush(orm);
    return this.mapper.toDomain(orm);
  }

  /**
   * Histórico agregado de um tecido — o DoD exige menos de 300 ms com 5.000 cortes.
   *
   * SQL cru porque `percentile_cont` não tem equivalente no query builder, e **mediana é o que
   * serve aqui**: a média de duração é destruída por um único corte que ficou parado enquanto o
   * cliente foi almoçar.
   *
   * A consulta é **parametrizada** (`?`), nunca concatenada — e o `account_id` está no `where`,
   * inline como toda consulta do projeto. O verificador `check:tenant-scope` também lê chamadas
   * de SQL cru.
   */
  async fabricHistory(
    accountId: AccountId,
    fabricId: FabricId,
    aroundPieces?: number | null,
  ): Promise<FabricHistory> {
    const lower = aroundPieces ? Math.floor(aroundPieces * VOLUME_BAND.lower) : null;
    const upper = aroundPieces ? Math.ceil(aroundPieces * VOLUME_BAND.upper) : null;

    const result = await this.em.getKnex().raw(
      `select
         count(*)::int as samples,
         percentile_cont(0.5) within group (order by layers) as median_layers,
         percentile_cont(0.5) within group (order by nested_pieces) as median_nested_pieces,
         percentile_cont(0.5) within group (order by total_pieces) as median_total_pieces,
         percentile_cont(0.5) within group (
           order by extract(epoch from (ended_at - started_at))
         ) as median_duration_seconds,
         percentile_cont(0.5) within group (
           order by extract(epoch from (ended_at - started_at)) / 60.0
                    / (total_pieces / 100.0)
         ) as median_minutes_per_100
       from "cut"
       where account_id = ?
         and fabric_id = ?
         and ended_at is not null
         and total_pieces > 0
         and (? ::int is null or total_pieces between ? ::int and ? ::int)`,
      [accountId.value, fabricId.value, lower, lower, upper],
    );

    const row = (result.rows ?? [])[0] ?? {};
    const num = (value: unknown): number | null =>
      value === null || value === undefined ? null : Math.round(Number(value) * 100) / 100;

    return {
      samples: Number(row.samples ?? 0),
      medianLayers: num(row.median_layers),
      medianNestedPieces: num(row.median_nested_pieces),
      medianTotalPieces: num(row.median_total_pieces),
      medianDurationSeconds: num(row.median_duration_seconds),
      medianMinutesPer100Pieces: num(row.median_minutes_per_100),
    };
  }
}
