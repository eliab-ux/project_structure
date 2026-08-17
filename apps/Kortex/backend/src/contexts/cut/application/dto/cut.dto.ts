import { Cut } from '../../domain/entities/cut.entity';
import { LayoutType } from '../../../../shared/domain/value-objects/layout-type';
import { NamedRef } from '../../../pre-order/application/dto/pre-order.dto';
import { FabricHistory } from '../ports/output/cut-repository.port';

/**
 * A matriz como o app do Modelista a consome. Sem dinheiro — apontamento é tempo e peça, não
 * preço.
 */
export class CutDto {
  id!: string;
  reservationId!: string;
  sequence!: number;
  markerName!: string | null;
  startedAt!: string;
  endedAt!: string | null;
  layers!: number | null;
  nestedPieces!: number | null;
  /** Derivado: `layers × nestedPieces`. Nunca aceito do cliente HTTP. */
  totalPieces!: number | null;
  layoutType!: LayoutType | null;
  durationSeconds!: number | null;
  fabric!: NamedRef;
  productType!: NamedRef;
  isRunning!: boolean;

  static fromDomain(cut: Cut, refs: { fabric: NamedRef; productType: NamedRef }): CutDto {
    const dto = new CutDto();
    dto.id = cut.id.value;
    dto.reservationId = cut.reservationId.value;
    dto.sequence = cut.sequence;
    dto.markerName = cut.markerName;
    dto.startedAt = cut.startedAt.toISOString();
    dto.endedAt = cut.endedAt?.toISOString() ?? null;
    dto.layers = cut.layers;
    dto.nestedPieces = cut.nestedPieces;
    dto.totalPieces = cut.totalPieces;
    dto.layoutType = cut.layoutType;
    dto.durationSeconds = cut.durationSeconds;
    dto.fabric = refs.fabric;
    dto.productType = refs.productType;
    dto.isRunning = cut.isRunning;
    // machine_cut_* não são mapeados: ficam nulos até a fase 7 e não têm o que mostrar.
    return dto;
  }
}

/** Resposta do stop: a matriz e o aviso de altura, quando houver. */
export class CutWithWarningsDto {
  cut!: CutDto;
  /** Vazio quando não há aviso. Nunca `null` — a UI itera sem checar. */
  warnings!: string[];

  static create(cut: CutDto, warnings: string[]): CutWithWarningsDto {
    const dto = new CutWithWarningsDto();
    dto.cut = cut;
    dto.warnings = warnings;
    return dto;
  }
}

/**
 * O histórico por tecido, como a tela de pré-pedido o consome.
 *
 * É o produto secundário do sistema: cada corte apontado melhora a estimativa do próximo.
 */
export class FabricHistoryDto {
  fabric!: NamedRef;
  samples!: number;
  medianLayers!: number | null;
  medianNestedPieces!: number | null;
  medianTotalPieces!: number | null;
  medianDurationSeconds!: number | null;
  medianMinutesPer100Pieces!: number | null;
  /** Sugestão de horas para o volume pedido — arredondada para cima, porque a venda é em hora cheia. */
  suggestedHours!: number | null;

  static create(
    fabric: NamedRef,
    history: FabricHistory,
    aroundPieces: number | null,
  ): FabricHistoryDto {
    const dto = new FabricHistoryDto();
    dto.fabric = fabric;
    dto.samples = history.samples;
    dto.medianLayers = history.medianLayers;
    dto.medianNestedPieces = history.medianNestedPieces;
    dto.medianTotalPieces = history.medianTotalPieces;
    dto.medianDurationSeconds = history.medianDurationSeconds;
    dto.medianMinutesPer100Pieces = history.medianMinutesPer100Pieces;

    /**
     * A sugestão é **sugestão**: quem define as horas é o Modelista (§4.7, §5). O sistema oferece
     * o número que o histórico aponta e para aí — a tela mostra, ele decide.
     *
     * Arredonda para cima porque a venda é em hora cheia (decisão 2.2), e para baixo o cliente
     * ficaria sem tempo.
     */
    // Comparação explícita com `null`, e não `if (valor)`: uma mediana **zero** é um número, e
    // trataria-la como ausência esconderia o histórico de cortes rápidos atrás de um "sem dados".
    dto.suggestedHours =
      aroundPieces && history.medianMinutesPer100Pieces !== null
        ? Math.max(1, Math.ceil((history.medianMinutesPer100Pieces * (aroundPieces / 100)) / 60))
        : null;

    return dto;
  }
}
