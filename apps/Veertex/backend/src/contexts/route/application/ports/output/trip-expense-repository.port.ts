import { TripExpense } from '../../../domain/entities/trip-expense.entity';

export const TRIP_EXPENSE_REPOSITORY = Symbol('TRIP_EXPENSE_REPOSITORY');

export interface TripExpenseRepositoryPort {
  listByTrip(tripId: string): Promise<TripExpense[]>;
  save(expense: TripExpense): Promise<TripExpense>;
}
