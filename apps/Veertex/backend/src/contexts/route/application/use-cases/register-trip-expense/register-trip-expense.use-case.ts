import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import {
  TRIP_EXPENSE_REPOSITORY,
  TripExpenseRepositoryPort,
} from '../../ports/output/trip-expense-repository.port';
import { TRIP_REPOSITORY, TripRepositoryPort } from '../../ports/output/trip-repository.port';
import { TripExpense, TripExpenseCategory } from '../../../domain/entities/trip-expense.entity';
import { TripNotFoundException } from '../../../domain/exceptions/route-exceptions';

export class RegisterTripExpenseCommand {
  constructor(
    public readonly accountId: string,
    public readonly input: {
      tripId: string;
      category: TripExpenseCategory;
      amount: number;
      note?: string | null;
      spentAt?: Date | null;
      /** Idempotência do sync de campo: reenvio com o MESMO uuid devolve a despesa existente. */
      clientUuid?: string | null;
    },
  ) {}
}

export interface TripExpenseResult {
  id: string;
  category: string;
  amount: number;
}

/** Lança uma despesa da viagem (§3.5 do 04) — diária, por categoria; entra no batimento. */
@Injectable()
export class RegisterTripExpenseUseCase implements UseCase<
  RegisterTripExpenseCommand,
  TripExpenseResult
> {
  constructor(
    @Inject(TRIP_EXPENSE_REPOSITORY) private readonly expenses: TripExpenseRepositoryPort,
    @Inject(TRIP_REPOSITORY) private readonly trips: TripRepositoryPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: RegisterTripExpenseCommand): Promise<TripExpenseResult> {
    return this.uow.execute(async () => {
      // Idempotência do sync: a outbox reenviou? Devolve o que já existe.
      if (command.input.clientUuid) {
        const existing = await this.expenses.findByClientUuid?.(command.input.clientUuid);
        if (existing) {
          return { id: existing.id, category: existing.category, amount: existing.amount };
        }
      }

      const trip = await this.trips.findById(command.input.tripId);
      if (!trip) {
        throw new TripNotFoundException();
      }
      const expense = TripExpense.create({
        accountId: command.accountId,
        tripId: command.input.tripId,
        category: command.input.category,
        amount: command.input.amount,
        note: command.input.note ?? null,
        spentAt: command.input.spentAt ?? null,
      });
      const saved = await this.expenses.save(expense, { clientUuid: command.input.clientUuid ?? null });
      return { id: saved.id, category: saved.category, amount: saved.amount };
    });
  }
}
