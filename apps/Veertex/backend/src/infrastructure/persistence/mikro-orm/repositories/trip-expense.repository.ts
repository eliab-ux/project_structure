import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { TripExpenseRepositoryPort } from '../../../../contexts/route/application/ports/output/trip-expense-repository.port';
import { TripExpense } from '../../../../contexts/route/domain/entities/trip-expense.entity';
import { TripExpenseOrmEntity } from '../entities/trip-expense-orm.entity';

@Injectable()
export class MikroOrmTripExpenseRepository implements TripExpenseRepositoryPort {
  constructor(private readonly em: EntityManager) {}

  private toDomain(orm: TripExpenseOrmEntity): TripExpense {
    return TripExpense.reconstitute({
      id: orm.id,
      accountId: orm.accountId,
      tripId: orm.tripId,
      category: orm.category,
      amount: orm.amount,
      note: orm.note,
      spentAt: orm.spentAt,
      createdAt: orm.createdAt,
    });
  }

  async listByTrip(tripId: string): Promise<TripExpense[]> {
    const rows = await this.em.find(
      TripExpenseOrmEntity,
      { tripId },
      { orderBy: { spentAt: 'ASC' } },
    );
    return rows.map((row) => this.toDomain(row));
  }

  async save(expense: TripExpense): Promise<TripExpense> {
    const orm = this.em.create(TripExpenseOrmEntity, {
      id: expense.id,
      accountId: expense.accountId,
      tripId: expense.tripId,
      category: expense.category,
      amount: expense.amount.toFixed(2),
      note: expense.note,
      spentAt: expense.spentAt,
      createdAt: expense.createdAt,
      updatedAt: new Date(),
      deletedAt: null,
    });
    this.em.persist(orm);
    await this.em.flush();
    return this.toDomain(orm);
  }
}
