import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { WhatsappInstanceNotFoundException } from '../../../domain/exceptions/whatsapp-instance-not-found.exception';
import { WHATSAPP_GATEWAY, WhatsappGatewayPort } from '../../ports/output/whatsapp-gateway.port';
import {
  WHATSAPP_INSTANCE_REPOSITORY,
  WhatsappInstanceRepositoryPort,
} from '../../ports/output/whatsapp-instance-repository.port';

/**
 * Remove a conexão por completo: apaga a instância na Evolution e o registro local.
 * Diferente do logout — depois disto, conectar de novo cria uma instância nova.
 */
@Injectable()
export class DeleteInstanceUseCase implements UseCase<{ userId: string }, void> {
  private readonly logger = new Logger(DeleteInstanceUseCase.name);

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
      await this.gateway.deleteInstance(instance.instanceName.value);
    } catch (error) {
      // O registro local é apagado de qualquer forma: manter uma linha apontando para uma
      // instância que talvez não exista mais só impediria o usuário de reconectar.
      this.logger.warn('Falha ao apagar a instância no provider; removendo registro local', {
        userId: command.userId,
        reason: (error as Error)?.message,
      });
    }

    await this.repository.delete(instance);
  }
}
