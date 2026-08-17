import { Inject, Injectable, Logger } from '@nestjs/common';
import { CUT_REPOSITORY, CutRepositoryPort } from '../ports/output/cut-repository.port';
import {
  RESERVATION_REPOSITORY,
  ReservationRepositoryPort,
} from '../../../schedule/application/ports/output/schedule-repository.port';
import {
  PRE_ORDER_REPOSITORY,
  PreOrderRepositoryPort,
} from '../../../pre-order/application/ports/output/pre-order-repository.port';
import {
  FABRIC_REPOSITORY,
  FabricRepositoryPort,
} from '../../../catalog/application/ports/output/catalog-repository.port';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../infrastructure/persistence/ports/unit-of-work.port';
import { CutDto, CutWithWarningsDto, FabricHistoryDto } from '../dto/cut.dto';
import {
  ReferenceResolver,
  fabricRefOrPlaceholder,
  refOrPlaceholder,
} from '../../../pre-order/application/reference-resolver';
import { Cut } from '../../domain/entities/cut.entity';
import {
  CutAlreadyRunningException,
  CutNotFoundException,
  ForbiddenCompletedReservationChangeException,
  ForbiddenCutOnUnpaidReservationException,
} from '../../domain/exceptions/cut.exceptions';
import { CutId } from '../../domain/value-objects/cut-id.vo';
import { AccountId } from '../../../account/domain/value-objects/account-id.vo';
import { FabricId } from '../../../catalog/domain/value-objects/fabric-id.vo';
import { ProductTypeId } from '../../../catalog/domain/value-objects/product-type-id.vo';
import { ReservationId } from '../../../schedule/domain/value-objects/reservation-id.vo';
import { Reservation } from '../../../schedule/domain/entities/reservation.entity';
import { ReservationNotFoundException } from '../../../schedule/domain/exceptions/schedule.exceptions';
import { LayoutType } from '../../../../shared/domain/value-objects/layout-type';
import { FabricNotFoundException } from '../../../catalog/domain/exceptions/catalog.exceptions';

export interface StopCutInput {
  layers: number;
  nestedPieces: number;
  layoutType: string;
  fabricId?: string | null;
  productTypeId?: string | null;
  markerName?: string | null;
}

@Injectable()
export class CutUseCases {
  private readonly logger = new Logger(CutUseCases.name);

  constructor(
    @Inject(CUT_REPOSITORY)
    private readonly cuts: CutRepositoryPort,
    @Inject(RESERVATION_REPOSITORY)
    private readonly reservations: ReservationRepositoryPort,
    @Inject(PRE_ORDER_REPOSITORY)
    private readonly preOrders: PreOrderRepositoryPort,
    @Inject(FABRIC_REPOSITORY)
    private readonly fabrics: FabricRepositoryPort,
    private readonly references: ReferenceResolver,
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async listByReservation(accountId: string, reservationId: string): Promise<CutDto[]> {
    const account = AccountId.from(accountId);
    const cuts = await this.cuts.listByReservation(account, ReservationId.from(reservationId));
    return this.toDtos(account, cuts);
  }

  /**
   * START — o primeiro toque.
   *
   * Só existe matriz em reserva paga (§4.10 + regra 2.4): uma `pre_reserved` recusa com 403. E a
   * primeira matriz é o que leva a reserva de `confirmed` para `in_progress` (§4.11).
   */
  async start(
    accountId: string,
    reservationId: string,
    markerName?: string | null,
  ): Promise<CutDto> {
    const account = AccountId.from(accountId);
    const reservation = await this.loadReservation(account, reservationId);

    if (reservation.status !== 'confirmed' && reservation.status !== 'in_progress') {
      if (reservation.status === 'completed') {
        throw new ForbiddenCompletedReservationChangeException();
      }
      throw new ForbiddenCutOnUnpaidReservationException();
    }

    const running = await this.cuts.findRunning(account, reservation.id);
    if (running) {
      throw new CutAlreadyRunningException(running.sequence);
    }

    // Tecido e produto vêm do pré-pedido; podem ser corrigidos no stop.
    const preOrder = await this.preOrders.findById(account, reservation.preOrderId);
    if (!preOrder) {
      throw new ReservationNotFoundException();
    }

    const existing = await this.cuts.listByReservation(account, reservation.id);
    const cut = Cut.start({
      accountId: account,
      reservationId: reservation.id,
      sequence: existing.length + 1,
      fabricId: preOrder.fabricId,
      productTypeId: preOrder.productTypeId,
      markerName,
    });

    const saved = await this.unitOfWork.execute(async () => {
      // O primeiro start move a reserva para "em execução".
      if (reservation.status === 'confirmed') {
        reservation.markInProgress();
        await this.reservations.save(reservation);
      }
      return this.cuts.save(cut);
    });

    this.logger.log('Matriz iniciada', {
      reservationId: reservation.id.value,
      sequence: saved.sequence,
    });

    return (await this.toDtos(account, [saved]))[0];
  }

  /**
   * STOP — o segundo toque. Confirma camadas, peças encaixadas e tipo de enfesto.
   *
   * `totalPieces` **não é parâmetro**: é calculado no domínio. Camadas acima da altura máxima do
   * tecido geram **aviso, não bloqueio** — quem está na máquina sabe mais que o cadastro.
   */
  async stop(accountId: string, cutId: string, input: StopCutInput): Promise<CutWithWarningsDto> {
    const account = AccountId.from(accountId);

    const cut = await this.cuts.findById(account, CutId.from(cutId));
    if (!cut) {
      throw new CutNotFoundException();
    }

    const reservation = await this.loadReservation(account, cut.reservationId.value);
    if (reservation.status === 'completed') {
      throw new ForbiddenCompletedReservationChangeException();
    }

    const fabricId = input.fabricId ? FabricId.from(input.fabricId) : cut.fabricId;
    const fabric = await this.fabrics.findById(account, fabricId);
    if (!fabric) {
      throw new FabricNotFoundException();
    }

    cut.stop({
      endedAt: new Date(),
      layers: input.layers,
      nestedPieces: input.nestedPieces,
      layoutType: input.layoutType as LayoutType,
      fabricId,
      productTypeId: input.productTypeId
        ? ProductTypeId.from(input.productTypeId)
        : cut.productTypeId,
      markerName: input.markerName ?? cut.markerName,
    });

    const warning = Cut.layersWarning(
      input.layers,
      fabric.maxLayerHeightCm,
      fabric.layerThicknessCm,
      fabric.name,
    );

    const saved = await this.unitOfWork.execute(async () => this.cuts.save(cut));

    this.logger.log('Matriz encerrada', {
      cutId: saved.id.value,
      totalPieces: saved.totalPieces,
      durationSeconds: saved.durationSeconds,
    });

    const dto = (await this.toDtos(account, [saved]))[0];
    return CutWithWarningsDto.create(dto, warning ? [warning] : []);
  }

  /**
   * O Modelista encerra a reserva (§4.11). A partir daqui as matrizes não são mais editáveis.
   *
   * Uma matriz em andamento impede o encerramento: seria fechar o serviço com um cronômetro
   * ainda correndo.
   */
  async completeReservation(accountId: string, reservationId: string): Promise<void> {
    const account = AccountId.from(accountId);
    const reservation = await this.loadReservation(account, reservationId);

    const running = await this.cuts.findRunning(account, reservation.id);
    if (running) {
      throw new CutAlreadyRunningException(running.sequence);
    }

    reservation.complete();
    await this.unitOfWork.execute(async () => this.reservations.save(reservation));
  }

  /**
   * Histórico por tecido — o parâmetro da próxima estimativa, consumido na tela de pré-pedido.
   *
   * A agregação roda no banco justamente por causa do DoD: menos de 300 ms com 5.000 cortes.
   */
  async fabricHistory(
    accountId: string,
    fabricId: string,
    aroundPieces?: number | null,
  ): Promise<FabricHistoryDto> {
    const account = AccountId.from(accountId);
    const fabric = FabricId.from(fabricId);

    const [history, refs] = await Promise.all([
      this.cuts.fabricHistory(account, fabric, aroundPieces ?? null),
      this.references.load(account),
    ]);

    return FabricHistoryDto.create(
      fabricRefOrPlaceholder(refs.fabrics, fabric.value),
      history,
      aroundPieces ?? null,
    );
  }

  private async loadReservation(accountId: AccountId, reservationId: string): Promise<Reservation> {
    const reservation = await this.reservations.findById(
      accountId,
      ReservationId.from(reservationId),
    );
    if (!reservation) {
      throw new ReservationNotFoundException();
    }
    return reservation;
  }

  private async toDtos(accountId: AccountId, cuts: Cut[]): Promise<CutDto[]> {
    if (cuts.length === 0) {
      return [];
    }

    const refs = await this.references.load(accountId);
    return cuts.map((cut) =>
      CutDto.fromDomain(cut, {
        fabric: fabricRefOrPlaceholder(refs.fabrics, cut.fabricId.value),
        productType: refOrPlaceholder(refs.productTypes, cut.productTypeId.value),
      }),
    );
  }
}
