import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import {
  ORDER_EVIDENCE_REPOSITORY,
  OrderEvidenceRepositoryPort,
} from '../../ports/output/order-evidence-repository.port';
import { OrderEvidence } from '../../../domain/entities/order-evidence.entity';
import { CONTACT_GEO, ContactGeoPort } from '../../ports/output/contact-geo.port';
import {
  ORDER_REPOSITORY,
  OrderRepositoryPort,
} from '../../../../order/application/ports/output/order-repository.port';
import { OrderId } from '../../../../order/domain/value-objects/order-id.vo';
import { GpsNotCapturedException } from '../../../domain/exceptions/route-exceptions';

export class ChangeOrderGpsCommand {
  constructor(
    public readonly accountId: string,
    /** QUEM alterou — do token, nunca do corpo. Parte da trilha exigida pelo aceite 2 do 04. */
    public readonly actorUserId: string,
    public readonly input: {
      orderId: string;
      latitude: number;
      longitude: number;
      reason: string;
    },
  ) {}
}

export interface ChangeOrderGpsResult {
  newEvidenceId: string;
  previousEvidenceId: string;
}

/**
 * A ÚNICA forma de "alterar" o GPS do pedido (§3.1 do 04 — aceite 2): ação explícita, auditada com
 * valor anterior (a evidência antiga fica intocada na cadeia), valor novo, quem e quando. Edições do
 * pedido NUNCA passam por aqui — o GPS da abertura é imutável por construção (append-only).
 */
@Injectable()
export class ChangeOrderGpsUseCase implements UseCase<ChangeOrderGpsCommand, ChangeOrderGpsResult> {
  private readonly logger = new Logger(ChangeOrderGpsUseCase.name);

  constructor(
    @Inject(ORDER_EVIDENCE_REPOSITORY) private readonly evidences: OrderEvidenceRepositoryPort,
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepositoryPort,
    @Inject(CONTACT_GEO) private readonly contactGeo: ContactGeoPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: ChangeOrderGpsCommand): Promise<ChangeOrderGpsResult> {
    return this.uow.execute(async () => {
      const current = await this.evidences.findCurrentGps(command.input.orderId);
      if (!current) {
        throw new GpsNotCapturedException();
      }

      const changed = await this.evidences.save(
        OrderEvidence.create({
          accountId: command.accountId,
          orderId: command.input.orderId,
          tripId: current.tripId,
          type: 'gps',
          latitude: command.input.latitude,
          longitude: command.input.longitude,
          previousEvidenceId: current.id,
          changedByUserId: command.actorUserId,
          changeReason: command.input.reason,
        }),
      );

      // A correção PROPAGA ao cadastro (overwrite=true): o ponto anterior estava errado, e
      // deixá-lo no endereço da revendedora perpetuaria o erro que esta ação existe para corrigir.
      const order = await this.orders.findById(OrderId.from(command.input.orderId));
      if (order) {
        await this.contactGeo.applyOrderGps({
          contactId: order.contactId,
          latitude: command.input.latitude,
          longitude: command.input.longitude,
          overwrite: true,
        });
      }

      // Trilha no log também (sem coordenada antiga/nova — elas vivem nas linhas, auditáveis).
      this.logger.warn('GPS do pedido alterado por ação explícita', {
        orderId: command.input.orderId,
        by: command.actorUserId,
      });

      return { newEvidenceId: changed.id, previousEvidenceId: current.id };
    });
  }
}
