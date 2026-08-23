import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { TRIP_REPOSITORY, TripRepositoryPort } from '../../ports/output/trip-repository.port';
import {
  FIELD_RECEIPT_REPOSITORY,
  FieldReceiptRepositoryPort,
} from '../../ports/output/field-receipt-repository.port';
import {
  TRIP_EXPENSE_REPOSITORY,
  TripExpenseRepositoryPort,
} from '../../ports/output/trip-expense-repository.port';
import {
  TRIP_COLLECTION_REPOSITORY,
  TripCollectionRepositoryPort,
} from '../../ports/output/trip-collection-repository.port';
import { TripDto } from '../../dto/trip.dto';
import { TripNotFoundException } from '../../../domain/exceptions/route-exceptions';

export class GetTripDetailsQuery {
  constructor(public readonly tripId: string) {}
}

export interface TripDetailsDto {
  trip: TripDto;
  /** Carteira montada (cobrança/recobrança) — vazia antes do build. */
  wallet: { titleId: string; kind: string; amountAtBuild: number }[];
  /** Recebimentos do acerto — os `proposto` são os que aguardam efetivação da retaguarda. */
  receipts: {
    id: string;
    titleId: string | null;
    method: string;
    amount: number;
    interest: number;
    insideWallet: boolean;
    status: string;
    createdAt: string;
  }[];
  expenses: {
    id: string;
    category: string;
    amount: number;
    note: string | null;
    spentAt: string;
  }[];
}

/**
 * A LEITURA da viagem para a tela da retaguarda: viagem + carteira + recebimentos + despesas numa
 * resposta. Sem ela, um recebimento lançado (`proposto`) e não efetivado sumiria da tela no
 * primeiro reload — dado órfão invisível é o defeito, não a falta de conveniência.
 */
@Injectable()
export class GetTripDetailsUseCase implements UseCase<GetTripDetailsQuery, TripDetailsDto> {
  constructor(
    @Inject(TRIP_REPOSITORY) private readonly trips: TripRepositoryPort,
    @Inject(TRIP_COLLECTION_REPOSITORY)
    private readonly collections: TripCollectionRepositoryPort,
    @Inject(FIELD_RECEIPT_REPOSITORY) private readonly receipts: FieldReceiptRepositoryPort,
    @Inject(TRIP_EXPENSE_REPOSITORY) private readonly expenses: TripExpenseRepositoryPort,
  ) {}

  async execute(query: GetTripDetailsQuery): Promise<TripDetailsDto> {
    const trip = await this.trips.findById(query.tripId);
    if (!trip) {
      throw new TripNotFoundException();
    }
    const [collections, receipts, expenses] = await Promise.all([
      this.collections.listByTrip(trip.id),
      this.receipts.listByTrip(trip.id),
      this.expenses.listByTrip(trip.id),
    ]);
    return {
      trip: TripDto.fromDomain(trip),
      wallet: collections.map((collection) => ({
        titleId: collection.titleId,
        kind: collection.kind,
        amountAtBuild: collection.amountAtBuild,
      })),
      receipts: receipts.map((receipt) => ({
        id: receipt.id,
        titleId: receipt.titleId,
        method: receipt.method,
        amount: receipt.amount,
        interest: receipt.interest,
        insideWallet: receipt.insideWallet,
        status: receipt.status,
        createdAt: receipt.createdAt.toISOString(),
      })),
      expenses: expenses.map((expense) => ({
        id: expense.id,
        category: expense.category,
        amount: expense.amount,
        note: expense.note,
        spentAt: expense.spentAt.toISOString(),
      })),
    };
  }
}
