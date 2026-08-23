import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import {
  ORDER_EVIDENCE_REPOSITORY,
  OrderEvidenceRepositoryPort,
} from '../../ports/output/order-evidence-repository.port';
import { EVIDENCE_STORAGE, EvidenceStoragePort } from '../../ports/output/evidence-storage.port';
import { CONTACT_GEO, ContactGeoPort } from '../../ports/output/contact-geo.port';
import {
  ORDER_REPOSITORY,
  OrderRepositoryPort,
} from '../../../../order/application/ports/output/order-repository.port';
import { OrderId } from '../../../../order/domain/value-objects/order-id.vo';
import { EvidenceType, OrderEvidence } from '../../../domain/entities/order-evidence.entity';
import { GpsAlreadyCapturedException } from '../../../domain/exceptions/route-exceptions';

export class RegisterOrderEvidenceCommand {
  constructor(
    public readonly accountId: string,
    public readonly input: {
      orderId: string;
      tripId?: string | null;
      type: EvidenceType;
      latitude?: number | null;
      longitude?: number | null;
      fileBase64?: string | null;
      fileMimeType?: string | null;
      capturedAt?: Date | null;
      /** Idempotência do sync de campo: reenvio com o MESMO uuid devolve a evidência existente. */
      clientUuid?: string | null;
    },
  ) {}
}

export interface OrderEvidenceResult {
  id: string;
  type: string;
  objectKey: string | null;
}

/**
 * Registra uma evidência do pedido (§3.1 do 04): GPS da ABERTURA (uma vez — capturar de novo é
 * recusado; alterar é a AÇÃO EXPLÍCITA auditada do `ChangeOrderGps`, nunca um re-registro) ou foto
 * (comprovante / promissória assinada), cujo binário vai ao storage (no-op até o `minio` entrar) e a
 * CHAVE fica na linha.
 */
@Injectable()
export class RegisterOrderEvidenceUseCase implements UseCase<
  RegisterOrderEvidenceCommand,
  OrderEvidenceResult
> {
  constructor(
    @Inject(ORDER_EVIDENCE_REPOSITORY) private readonly evidences: OrderEvidenceRepositoryPort,
    @Inject(EVIDENCE_STORAGE) private readonly storage: EvidenceStoragePort,
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepositoryPort,
    @Inject(CONTACT_GEO) private readonly contactGeo: ContactGeoPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: RegisterOrderEvidenceCommand): Promise<OrderEvidenceResult> {
    return this.uow.execute(async () => {
      const { input } = command;

      // Idempotência do sync: reenvio da outbox devolve a evidência já registrada.
      if (input.clientUuid) {
        const existing = await this.evidences.findByClientUuid?.(input.clientUuid);
        if (existing) {
          return { id: existing.id, type: existing.type, objectKey: existing.objectKey };
        }
      }

      // GPS é capturado UMA vez, na abertura (imutável). Alteração = ChangeOrderGps, auditada.
      if (input.type === 'gps') {
        const existing = await this.evidences.findCurrentGps(input.orderId);
        if (existing) {
          throw new GpsAlreadyCapturedException();
        }
      }

      let objectKey: string | null = null;
      if (input.fileBase64 && input.type !== 'gps') {
        objectKey = await this.storage.store({
          accountId: command.accountId,
          orderId: input.orderId,
          kind: input.type,
          fileBase64: input.fileBase64,
          fileMimeType: input.fileMimeType ?? 'image/jpeg',
        });
      }

      const evidence = OrderEvidence.create({
        accountId: command.accountId,
        orderId: input.orderId,
        tripId: input.tripId ?? null,
        type: input.type,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        objectKey,
        capturedAt: input.capturedAt ?? null,
      });
      const saved = await this.evidences.save(evidence, { clientUuid: input.clientUuid ?? null });

      // §3.1: o GPS da abertura é PROPAGADO ao cadastro da revendedora — preenche a coordenada do
      // endereço se o cadastro ainda não tem (overwrite=false: primeira visita georreferencia,
      // nunca sobrescreve).
      if (input.type === 'gps' && input.latitude != null && input.longitude != null) {
        const order = await this.orders.findById(OrderId.from(input.orderId));
        if (order) {
          await this.contactGeo.applyOrderGps({
            contactId: order.contactId,
            latitude: input.latitude,
            longitude: input.longitude,
            overwrite: false,
          });
        }
      }

      return { id: saved.id, type: saved.type, objectKey: saved.objectKey };
    });
  }
}
