import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  WHATSAPP_INSTANCE_REPOSITORY,
  WhatsappInstanceRepositoryPort,
} from '../../ports/output/whatsapp-instance-repository.port';
import {
  EVOLUTION_GATEWAY,
  EvolutionGatewayPort,
} from '../../ports/output/evolution-gateway.port';
import { UNIT_OF_WORK, UnitOfWorkPort } from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import { WhatsappStatusDto } from '../../dto/whatsapp-status.dto';

export class GetWhatsappStatusQuery {
  constructor(public readonly psicologoId: string) {}
}

@Injectable()
export class GetWhatsappStatusUseCase
  implements UseCase<GetWhatsappStatusQuery, WhatsappStatusDto>
{
  constructor(
    @Inject(WHATSAPP_INSTANCE_REPOSITORY) private readonly repo: WhatsappInstanceRepositoryPort,
    @Inject(EVOLUTION_GATEWAY) private readonly evolution: EvolutionGatewayPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(query: GetWhatsappStatusQuery): Promise<WhatsappStatusDto> {
    const canCreateOwn = this.evolution.canCreateInstances();
    const hasShared = !!this.evolution.sharedInstance();
    const instance = await this.repo.findByPsicologo(query.psicologoId);

    if (!instance) {
      return WhatsappStatusDto.from({ instance: null, canCreateOwn, hasShared });
    }

    if (instance.mode === 'shared') {
      return WhatsappStatusDto.from({ instance, connected: true, canCreateOwn, hasShared });
    }

    // 'own': consulta estado; se ainda não pareado, traz o QR atual.
    const connected = await this.evolution
      .isConnected(instance.instanceName, instance.apiKey)
      .catch(() => false);
    if (connected) {
      if (!instance.connected) {
        instance.setConnected(true);
        await this.uow.execute(() => this.repo.save(instance)).catch(() => undefined);
      }
      return WhatsappStatusDto.from({ instance, connected: true, canCreateOwn, hasShared });
    }

    const info = await this.evolution
      .connect(instance.instanceName, instance.apiKey)
      .catch(() => ({ qrBase64: null, connected: false }));
    return WhatsappStatusDto.from({
      instance,
      connected: info.connected,
      qrBase64: info.qrBase64,
      canCreateOwn,
      hasShared,
    });
  }
}
