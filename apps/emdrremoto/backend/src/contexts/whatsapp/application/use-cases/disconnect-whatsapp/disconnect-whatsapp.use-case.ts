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

export class DisconnectWhatsappCommand {
  constructor(public readonly psicologoId: string) {}
}

@Injectable()
export class DisconnectWhatsappUseCase implements UseCase<DisconnectWhatsappCommand, void> {
  constructor(
    @Inject(WHATSAPP_INSTANCE_REPOSITORY) private readonly repo: WhatsappInstanceRepositoryPort,
    @Inject(EVOLUTION_GATEWAY) private readonly evolution: EvolutionGatewayPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: DisconnectWhatsappCommand): Promise<void> {
    const instance = await this.repo.findByPsicologo(command.psicologoId);
    if (!instance) {
      return;
    }
    // Só remove a instância no Evolution se for própria (a compartilhada é de outros também).
    if (instance.mode === 'own') {
      await this.evolution
        .deleteInstance(instance.instanceName, instance.apiKey)
        .catch(() => undefined);
    }
    await this.uow.execute(() => this.repo.delete(command.psicologoId));
  }
}
