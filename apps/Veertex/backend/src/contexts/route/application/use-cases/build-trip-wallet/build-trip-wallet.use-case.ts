import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import {
  FINANCIAL_TITLE_REPOSITORY,
  FinancialTitleRepositoryPort,
} from '../../../../finance/application/ports/output/financial-title-repository.port';
import { TRIP_REPOSITORY, TripRepositoryPort } from '../../ports/output/trip-repository.port';
import {
  TRIP_COLLECTION_REPOSITORY,
  TripCollectionRepositoryPort,
} from '../../ports/output/trip-collection-repository.port';
import {
  WALLET_TITLE_LOOKUP,
  WalletTitleLookupPort,
} from '../../ports/output/wallet-title-lookup.port';
import { ROT_WALLET_PARAMS, RotWalletParamsPort } from '../../ports/output/rot-wallet-params.port';
import { TripCollection } from '../../../domain/entities/trip-collection.entity';
import { TripNotFoundException } from '../../../domain/exceptions/route-exceptions';

export class BuildTripWalletCommand {
  constructor(
    public readonly accountId: string,
    public readonly tripId: string,
  ) {}
}

export interface BuildTripWalletResult {
  added: { titleId: string; kind: string; amount: number }[];
  /** Títulos que a política "perdida" tirou da carteira nesta montagem (§3.4 do 04). */
  writtenOffPending: string[];
  walletTotal: number;
}

/**
 * Monta a CARTEIRA da viagem (§3.4 do 04): títulos de consignação em aberto dos contatos da rota.
 * `cobranca` se nenhuma viagem cobrou o título ainda; `recobranca` se rolou de passagem anterior.
 *
 * **Política "perdida" aplicada AQUI, na montagem:** título que já passou por 1 cobrança + N
 * recobranças (N = limiar CONFIGURÁVEL por conta) sem quitar vira `written_off_pending`
 * automaticamente — SAI da carteira (não viaja mais, não polui o % do representante) mas PERMANECE
 * no FIN até ação manual. Pagamento posterior: baixa normal (a quitação vence a sinalização).
 *
 * Idempotente por (viagem, título): remontar não duplica linhas.
 */
@Injectable()
export class BuildTripWalletUseCase implements UseCase<
  BuildTripWalletCommand,
  BuildTripWalletResult
> {
  constructor(
    @Inject(TRIP_REPOSITORY) private readonly trips: TripRepositoryPort,
    @Inject(TRIP_COLLECTION_REPOSITORY)
    private readonly collections: TripCollectionRepositoryPort,
    @Inject(WALLET_TITLE_LOOKUP) private readonly walletTitles: WalletTitleLookupPort,
    @Inject(FINANCIAL_TITLE_REPOSITORY) private readonly titles: FinancialTitleRepositoryPort,
    @Inject(ROT_WALLET_PARAMS) private readonly params: RotWalletParamsPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: BuildTripWalletCommand): Promise<BuildTripWalletResult> {
    return this.uow.execute(async () => {
      const trip = await this.trips.findById(command.tripId);
      if (!trip) {
        throw new TripNotFoundException();
      }

      const recollectionLimit = await this.params.recollectionLimit();
      const candidates = await this.walletTitles.findOpenConsignmentTitlesByRoute(trip.routeId);

      const result: BuildTripWalletResult = { added: [], writtenOffPending: [], walletTotal: 0 };

      for (const candidate of candidates) {
        if (await this.collections.existsForTripTitle(trip.id, candidate.titleId)) {
          continue; // idempotência: já está na carteira desta viagem
        }

        const timesCollected = await this.collections.countByTitle(candidate.titleId);

        // "Perdida" (§3.4): 1 cobrança + N recobranças sem quitar → sai da carteira, fica no FIN.
        if (timesCollected >= 1 + recollectionLimit) {
          const title = await this.titles.findById(candidate.titleId);
          if (title) {
            title.flagWrittenOffPending();
            await this.titles.save(title);
            result.writtenOffPending.push(candidate.titleId);
          }
          continue;
        }

        const collection = TripCollection.create({
          accountId: command.accountId,
          tripId: trip.id,
          titleId: candidate.titleId,
          kind: timesCollected === 0 ? 'cobranca' : 'recobranca',
          amountAtBuild: candidate.openAmount,
        });
        await this.collections.save(collection);
        result.added.push({
          titleId: candidate.titleId,
          kind: collection.kind,
          amount: candidate.openAmount,
        });
        result.walletTotal += candidate.openAmount;
      }

      result.walletTotal = Math.round((result.walletTotal + Number.EPSILON) * 100) / 100;
      return result;
    });
  }
}
