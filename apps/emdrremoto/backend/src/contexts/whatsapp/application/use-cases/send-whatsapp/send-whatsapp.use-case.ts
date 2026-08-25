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
import { WhatsappNotConfiguredException } from '../../../domain/exceptions/whatsapp.exceptions';

export class SendWhatsappCommand {
  constructor(
    public readonly psicologoId: string,
    public readonly phone: string,
    public readonly text: string,
  ) {}
}

@Injectable()
export class SendWhatsappUseCase implements UseCase<SendWhatsappCommand, void> {
  constructor(
    @Inject(WHATSAPP_INSTANCE_REPOSITORY) private readonly repo: WhatsappInstanceRepositoryPort,
    @Inject(EVOLUTION_GATEWAY) private readonly evolution: EvolutionGatewayPort,
  ) {}

  async execute(command: SendWhatsappCommand): Promise<void> {
    const instance = await this.repo.findByPsicologo(command.psicologoId);
    if (!instance) {
      throw new WhatsappNotConfiguredException();
    }
    await this.evolution.sendText(
      instance.instanceName,
      instance.apiKey,
      command.phone,
      command.text,
    );
  }
}
