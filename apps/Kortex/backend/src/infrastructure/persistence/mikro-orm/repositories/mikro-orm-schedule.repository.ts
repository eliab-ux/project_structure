import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/core';
import {
  ReservationRepositoryPort,
  ScheduleEntryRepositoryPort,
} from '../../../../contexts/schedule/application/ports/output/schedule-repository.port';
import { ScheduleEntry } from '../../../../contexts/schedule/domain/entities/schedule-entry.entity';
import { Reservation } from '../../../../contexts/schedule/domain/entities/reservation.entity';
import { ScheduleEntryId } from '../../../../contexts/schedule/domain/value-objects/schedule-entry-id.vo';
import { ReservationId } from '../../../../contexts/schedule/domain/value-objects/reservation-id.vo';
import { AccountId } from '../../../../contexts/account/domain/value-objects/account-id.vo';
import { ScheduleEntryOrmEntity } from '../entities/schedule-entry-orm.entity';
import { ReservationOrmEntity } from '../entities/reservation-orm.entity';
import { ReservationMapper, ScheduleEntryMapper } from '../mappers/schedule.mapper';

@Injectable()
export class MikroOrmScheduleEntryRepository implements ScheduleEntryRepositoryPort {
  constructor(
    @InjectRepository(ScheduleEntryOrmEntity)
    private readonly repo: EntityRepository<ScheduleEntryOrmEntity>,
    private readonly em: EntityManager,
    private readonly mapper: ScheduleEntryMapper,
  ) {}

  async listInRange(accountId: AccountId, from: Date, to: Date): Promise<ScheduleEntry[]> {
    /**
     * Tudo que TOCA a janela, não só o que começa dentro dela.
     *
     * `startsAt < to && endsAt > from` é a interseção de intervalos: uma reserva das 10h às 14h
     * precisa aparecer numa busca das 12h às 13h. Filtrar por `startsAt between from and to`
     * esconderia justamente a reserva longa que já estava em curso — e a agenda mostraria um
     * horário livre que não está.
     */
    const rows = await this.repo.find(
      {
        accountId: accountId.value,
        startsAt: { $lt: to },
        endsAt: { $gt: from },
      },
      { orderBy: { startsAt: 'ASC' } },
    );
    return rows.map((row) => this.mapper.toDomain(row));
  }

  async findById(accountId: AccountId, id: ScheduleEntryId): Promise<ScheduleEntry | null> {
    const orm = await this.repo.findOne({ accountId: accountId.value, id: id.value });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async save(entry: ScheduleEntry): Promise<ScheduleEntry> {
    const existing = await this.repo.findOne({
      accountId: entry.accountId.value,
      id: entry.id.value,
    });
    const orm = this.mapper.toOrm(entry, existing ?? undefined);
    await this.em.persistAndFlush(orm);
    return this.mapper.toDomain(orm);
  }

  async delete(accountId: AccountId, id: ScheduleEntryId): Promise<void> {
    await this.em.nativeDelete(ScheduleEntryOrmEntity, {
      accountId: accountId.value,
      id: id.value,
    });
  }
}

@Injectable()
export class MikroOrmReservationRepository implements ReservationRepositoryPort {
  constructor(
    @InjectRepository(ReservationOrmEntity)
    private readonly repo: EntityRepository<ReservationOrmEntity>,
    private readonly em: EntityManager,
    private readonly mapper: ReservationMapper,
  ) {}

  async listByAccount(accountId: AccountId): Promise<Reservation[]> {
    const rows = await this.repo.find(
      { accountId: accountId.value },
      { orderBy: { createdAt: 'DESC' } },
    );
    return rows.map((row) => this.mapper.toDomain(row));
  }

  /**
   * A fila do Modelista — o filtro de status mora AQUI (§5).
   *
   * "Endpoints de fila/agenda para o Modelista filtram `status IN ('confirmed','in_progress')` no
   * repositório. Uma reserva `pre_reserved` nunca sai da persistência para ele." É a diferença
   * entre esconder na tela e não trazer do banco: a segunda sobrevive a um refactor no use case.
   */
  async listVisibleToModelista(accountId: AccountId): Promise<Reservation[]> {
    const rows = await this.repo.find(
      {
        accountId: accountId.value,
        status: { $in: ['confirmed', 'in_progress'] },
      },
      { orderBy: { createdAt: 'ASC' } },
    );
    return rows.map((row) => this.mapper.toDomain(row));
  }

  async findById(accountId: AccountId, id: ReservationId): Promise<Reservation | null> {
    const orm = await this.repo.findOne({ accountId: accountId.value, id: id.value });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async findByScheduleEntry(
    accountId: AccountId,
    id: ScheduleEntryId,
  ): Promise<Reservation | null> {
    const orm = await this.repo.findOne({
      accountId: accountId.value,
      scheduleEntryId: id.value,
    });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async save(reservation: Reservation): Promise<Reservation> {
    const existing = await this.repo.findOne({
      accountId: reservation.accountId.value,
      id: reservation.id.value,
    });
    const orm = this.mapper.toOrm(reservation, existing ?? undefined);
    await this.em.persistAndFlush(orm);
    return this.mapper.toDomain(orm);
  }
}
