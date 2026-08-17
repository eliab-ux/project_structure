import { Cut } from '../../../domain/entities/cut.entity';
import { CutId } from '../../../domain/value-objects/cut-id.vo';
import { AccountId } from '../../../../account/domain/value-objects/account-id.vo';
import { FabricId } from '../../../../catalog/domain/value-objects/fabric-id.vo';
import { ReservationId } from '../../../../schedule/domain/value-objects/reservation-id.vo';

export const CUT_REPOSITORY = Symbol('CUT_REPOSITORY');

/** Resumo do histórico por tecido — o parâmetro da próxima estimativa (spec §7, Fase 5). */
export interface FabricHistory {
  samples: number;
  medianLayers: number | null;
  medianNestedPieces: number | null;
  medianTotalPieces: number | null;
  medianDurationSeconds: number | null;
  /**
   * Mediana de minutos por 100 peças — o número que realmente serve para estimar horas.
   *
   * Camadas e peças variam com o tamanho do lote; **tempo por peça** é o que se transporta de um
   * corte para o próximo.
   */
  medianMinutesPer100Pieces: number | null;
}

export interface CutRepositoryPort {
  listByReservation(accountId: AccountId, reservationId: ReservationId): Promise<Cut[]>;
  findById(accountId: AccountId, id: CutId): Promise<Cut | null>;
  /** A matriz em andamento desta reserva, se houver. */
  findRunning(accountId: AccountId, reservationId: ReservationId): Promise<Cut | null>;
  save(cut: Cut): Promise<Cut>;

  /**
   * Histórico agregado de um tecido. Precisa responder em menos de 300 ms com 5.000 cortes
   * semeados (DoD da Fase 5) — por isso é agregação no banco, não `map`/`reduce` em memória.
   *
   * `aroundPieces` recorta lotes de volume comparável: cortar 100 peças e cortar 5.000 não têm o
   * mesmo ritmo, e misturá-los produziria uma mediana que não descreve nenhum dos dois.
   */
  fabricHistory(
    accountId: AccountId,
    fabricId: FabricId,
    aroundPieces?: number | null,
  ): Promise<FabricHistory>;
}
