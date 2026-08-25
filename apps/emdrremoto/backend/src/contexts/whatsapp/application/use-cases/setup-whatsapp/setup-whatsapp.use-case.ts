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
import { WhatsappInstance, WhatsappMode } from '../../../domain/entities/whatsapp-instance.entity';
import {
  WhatsappOwnInstanceUnavailableException,
  WhatsappSharedUnavailableException,
} from '../../../domain/exceptions/whatsapp.exceptions';
import { WhatsappStatusDto } from '../../dto/whatsapp-status.dto';

export class SetupWhatsappCommand {
  constructor(
    public readonly psicologoId: string,
    public readonly mode: WhatsappMode,
  ) {}
}

@Injectable()
export class SetupWhatsappUseCase implements UseCase<SetupWhatsappCommand, WhatsappStatusDto> {
  constructor(
    @Inject(WHATSAPP_INSTANCE_REPOSITORY) private readonly repo: WhatsappInstanceRepositoryPort,
    @Inject(EVOLUTION_GATEWAY) private readonly evolution: EvolutionGatewayPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: SetupWhatsappCommand): Promise<WhatsappStatusDto> {
    // Se já havia uma instância própria, remove antes de trocar de modo.
    const existing = await this.repo.findByPsicologo(command.psicologoId);
    if (existing && existing.mode === 'own') {
      await this.evolution
        .deleteInstance(existing.instanceName, existing.apiKey)
        .catch(() => undefined);
    }

    if (command.mode === 'shared') {
      const shared = this.evolution.sharedInstance();
      if (!shared) {
        throw new WhatsappSharedUnavailableException();
      }
      const instance = WhatsappInstance.shared(
        command.psicologoId,
        shared.instanceName,
        shared.apiKey,
      );
      const saved = await this.uow.execute(() => this.repo.save(instance));
      return WhatsappStatusDto.from({
        instance: saved,
        connected: true,
        canCreateOwn: this.evolution.canCreateInstances(),
        hasShared: true,
      });
    }

    // mode === 'own'
    if (!this.evolution.canCreateInstances()) {
      throw new WhatsappOwnInstanceUnavailableException();
    }
    const instanceName = `emdr-${command.psicologoId.slice(0, 8)}`;
    const created = await this.evolution.createInstance(instanceName);
    const instance = WhatsappInstance.own(command.psicologoId, instanceName, created.apiKey);
    const saved = await this.uow.execute(() => this.repo.save(instance));
    return WhatsappStatusDto.from({
      instance: saved,
      connected: false,
      qrBase64: created.qrBase64,
      canCreateOwn: true,
      hasShared: !!this.evolution.sharedInstance(),
    });
  }
}
