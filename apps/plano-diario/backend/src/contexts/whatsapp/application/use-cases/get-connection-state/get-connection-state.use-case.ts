import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { ConnectionStatus } from '../../../domain/value-objects/connection-status.vo';
import { WhatsappInstanceDto } from '../../dto/whatsapp-instance.dto';
import { WHATSAPP_GATEWAY, WhatsappGatewayPort } from '../../ports/output/whatsapp-gateway.port';
import {
  WHATSAPP_INSTANCE_REPOSITORY,
  WhatsappInstanceRepositoryPort,
} from '../../ports/output/whatsapp-instance-repository.port';

/**
 * Estado da conexão, consultado no provider (fonte de verdade) e refletido no banco.
 * É o que o polling da tela de QR chama a cada 3 segundos.
 *
 * Devolve `null` quando o usuário nunca conectou — "não tem WhatsApp" é uma resposta válida,
 * não um erro, e o frontend precisa distinguir isso de "está desconectado".
 */
@Injectable()
export class GetConnectionStateUseCase implements UseCase<
  { userId: string },
  WhatsappInstanceDto | null
> {
  constructor(
    @Inject(WHATSAPP_INSTANCE_REPOSITORY)
    private readonly repository: WhatsappInstanceRepositoryPort,
    @Inject(WHATSAPP_GATEWAY) private readonly gateway: WhatsappGatewayPort,
  ) {}

  async execute(command: { userId: string }): Promise<WhatsappInstanceDto | null> {
    const instance = await this.repository.findByUserId(command.userId);
    if (!instance) {
      return null;
    }

    try {
      const connection = await this.gateway.getConnectionState(
        instance.instanceName.value,
        instance.token,
      );
      instance.syncStatus(
        ConnectionStatus.from(connection.status),
        connection.connectedNumber ?? null,
      );
      await this.repository.save(instance);
    } catch {
      // Provider indisponível não é motivo para falhar a tela: devolvemos o último estado
      // conhecido do banco. O envio diário, esse sim, revalida antes de mandar a mensagem.
    }

    return WhatsappInstanceDto.fromDomain(instance);
  }
}
