import { Cut } from '../../domain/entities/cut.entity';
import { LayoutType } from '../../../../shared/domain/value-objects/layout-type';
import { FabricRef, NamedRef } from '../../../pre-order/application/dto/pre-order.dto';
import { PreOrderItem } from '../../../pre-order/domain/entities/pre-order-item.entity';
import { FabricHistory } from '../ports/output/cut-repository.port';

/**
 * A matriz como o app do Modelista a consome. Sem dinheiro — apontamento é tempo e peça, não
 * preço.
 */
export class CutDto {
  id!: string;
  reservationId!: string;
  /** A matriz declarada que este apontamento executa (§4.10). */
  preOrderItemId!: string;
  /** Ordem da matriz **no pedido** — vem do `pre_order_item`, não do corte. */
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

  static fromDomain(
    cut: Cut,
    refs: { fabric: NamedRef; productType: NamedRef; sequence: number },
  ): CutDto {
    const dto = new CutDto();
    dto.id = cut.id.value;
    dto.reservationId = cut.reservationId.value;
    dto.preOrderItemId = cut.preOrderItemId.value;
    dto.sequence = refs.sequence;
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

/**
 * Uma matriz declarada, com o apontamento dela se já houver — a linha da tela do Modelista.
 *
 * A tela é dirigida pelo **pedido**, não pelos cortes: as matrizes aparecem todas, apontadas ou
 * não, e o botão de começar só existe nas que ainda não têm `cut`. É assim que a regra "só a
 * quantidade de matriz que tem no pedido" fica visível antes de virar erro.
 */
export class ReservationMatrizDto {
  preOrderItemId!: string;
  sequence!: number;
  fabric!: FabricRef;
  productType!: NamedRef;
  estimatedPieces!: number;
  estimatedLayers!: number | null;
  /** `null` enquanto ninguém deu start nesta matriz. */
  cut!: CutDto | null;
}

/**
 * A tela de matrizes de uma reserva.
 *
 * **O tempo que vale é o do pedido** (§4.10): do primeiro start ao último stop, intervalos entre
 * matrizes incluídos — eles aconteceram dentro da hora que o cliente comprou. A duração por matriz
 * segue em cada `cut`, mas serve a métrica, não a cobrança: somar as matrizes daria um número
 * menor que o tempo realmente ocupado na máquina.
 */
export class ReservationMatrizesDto {
  reservationId!: string;
  matrizes!: ReservationMatrizDto[];
  /** Primeiro start do pedido, ou `null` se nada começou. */
  startedAt!: string | null;
  /** Último stop, ou `null` enquanto alguma matriz corre — aí o total ainda está aberto. */
  endedAt!: string | null;
  /**
   * Do primeiro start ao último stop. Enquanto houver matriz correndo vem `null`: a tela conta
   * a partir de `startedAt`, para o número andar sem recarregar a página.
   */
  totalDurationSeconds!: number | null;
  /** Todas as matrizes declaradas já foram apontadas — não há mais o que começar. */
  allPointed!: boolean;

  static create(
    reservationId: string,
    items: PreOrderItem[],
    cuts: CutDto[],
    refs: { fabricOf: (fabricId: string) => FabricRef; productTypeOf: (id: string) => NamedRef },
  ): ReservationMatrizesDto {
    const porItem = new Map(cuts.map((cut) => [cut.preOrderItemId, cut]));

    const dto = new ReservationMatrizesDto();
    dto.reservationId = reservationId;
    dto.matrizes = items.map((item) => {
      const linha = new ReservationMatrizDto();
      linha.preOrderItemId = item.id.value;
      linha.sequence = item.sequence;
      linha.fabric = refs.fabricOf(item.fabricId.value);
      linha.productType = refs.productTypeOf(item.productTypeId.value);
      linha.estimatedPieces = item.estimate.estimatedPieces;
      linha.estimatedLayers = item.estimate.estimatedLayers;
      linha.cut = porItem.get(item.id.value) ?? null;
      return linha;
    });

    const iniciados = cuts.map((cut) => Date.parse(cut.startedAt));
    dto.startedAt = iniciados.length > 0 ? new Date(Math.min(...iniciados)).toISOString() : null;

    const emAndamento = cuts.some((cut) => cut.endedAt === null);
    const encerrados = cuts
      .map((cut) => cut.endedAt)
      .filter((value): value is string => value !== null)
      .map((value) => Date.parse(value));

    dto.endedAt =
      !emAndamento && encerrados.length > 0
        ? new Date(Math.max(...encerrados)).toISOString()
        : null;
    dto.totalDurationSeconds =
      dto.startedAt && dto.endedAt
        ? Math.round((Date.parse(dto.endedAt) - Date.parse(dto.startedAt)) / 1000)
        : null;

    dto.allPointed = items.length > 0 && cuts.length >= items.length;
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
/**
 * A matriz que está rodando agora — o mínimo para o indicador flutuante do Modelista.
 *
 * Só identidade e início: o tempo decorrido é calculado na tela, a cada segundo, a partir de
 * `startedAt`. Mandar o cronômetro pronto obrigaria a recarregar a página para o número andar.
 */
export class RunningCutDto {
  cutId!: string;
  reservationId!: string;
  sequence!: number;
  markerName!: string | null;
  startedAt!: string;

  static fromDomain(cut: Cut, sequence: number): RunningCutDto {
    const dto = new RunningCutDto();
    dto.cutId = cut.id.value;
    dto.reservationId = cut.reservationId.value;
    dto.sequence = sequence;
    dto.markerName = cut.markerName;
    dto.startedAt = cut.startedAt.toISOString();
    return dto;
  }
}

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
