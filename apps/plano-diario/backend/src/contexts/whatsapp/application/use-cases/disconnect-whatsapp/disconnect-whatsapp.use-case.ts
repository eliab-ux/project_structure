import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { WhatsappInstanceNotFoundException } from '../../../domain/exceptions/whatsapp-instance-not-found.exception';
import { ConnectionStatus } from '../../../domain/value-objects/connection-status.vo';
import { WHATSAPP_GATEWAY, WhatsappGatewayPort } from '../../ports/output/whatsapp-gateway.port';
import {
  WHATSAPP_INSTANCE_REPOSITORY,
  WhatsappInstanceRepositoryPort,
} from '../../ports/output/whatsapp-instance-repository.port';

/**
 * Desconecta o WhatsApp (logout na Evolution) mantendo a instância — o usuário pode parear de
 * novo lendo um QR, sem recriar nada.
 */
@Injectable()
export class DisconnectWhatsappUseCase implements UseCase<{ userId: string }, void> {
  private readonly logger = new Logger(DisconnectWhatsappUseCase.name);

  constructor(
    @Inject(WHATSAPP_INSTANCE_REPOSITORY)
    private readonly repository: WhatsappInstanceRepositoryPort,
    @Inject(WHATSAPP_GATEWAY) private readonly gateway: WhatsappGatewayPort,
  ) {}

  async execute(command: { userId: string }): Promise<void> {
    const instance = await this.repository.findByUserId(command.userId);
    if (!instance) {
      throw new WhatsappInstanceNotFoundException();
    }

    try {
      await this.gateway.logout(instance.instanceName.value, instance.token);
    } catch (error) {
      // Se o provider já não tinha a sessão, o resultado desejado (desconectado) está atingido.
      this.logger.warn('Logout no provider falhou; marcando desconectado localmente', {
        userId: command.userId,
        reason: (error as Error)?.message,
      });
    }

    instance.syncStatus(ConnectionStatus.DISCONNECTED);
    await this.repository.save(instance);
  }
}
