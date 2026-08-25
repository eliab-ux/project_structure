import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { WhatsappInstance } from '../../../domain/entities/whatsapp-instance.entity';
import { ProviderInstanceMissingException } from '../../../domain/exceptions/provider-instance-missing.exception';
import { ConnectionStatus } from '../../../domain/value-objects/connection-status.vo';
import { InstanceName } from '../../../domain/value-objects/instance-name.vo';
import { QrCodeDto } from '../../dto/whatsapp-instance.dto';
import { WHATSAPP_GATEWAY, WhatsappGatewayPort } from '../../ports/output/whatsapp-gateway.port';
import {
  WHATSAPP_INSTANCE_REPOSITORY,
  WhatsappInstanceRepositoryPort,
} from '../../ports/output/whatsapp-instance-repository.port';

/**
 * "Conectar WhatsApp": cria a instância própria do usuário na Evolution (se ainda não existir)
 * e devolve o QR Code para ele escanear no celular.
 *
 * Obrigatoriamente uma instância NOVA por usuário — nenhuma conexão existente do servidor é
 * reaproveitada. Chamar de novo quando a instância já existe apenas gera um QR novo, porque o
 * QR da Evolution expira em ~60 segundos.
 */
@Injectable()
export class ConnectWhatsappUseCase implements UseCase<{ userId: string }, QrCodeDto> {
  private readonly logger = new Logger(ConnectWhatsappUseCase.name);

  constructor(
    @Inject(WHATSAPP_INSTANCE_REPOSITORY)
    private readonly repository: WhatsappInstanceRepositoryPort,
    @Inject(WHATSAPP_GATEWAY) private readonly gateway: WhatsappGatewayPort,
  ) {}

  async execute(command: { userId: string }): Promise<QrCodeDto> {
    const existing = await this.repository.findByUserId(command.userId);

    // Já conectado: não gera QR novo — isso derrubaria a sessão que está funcionando.
    if (existing?.status.isConnected) {
      return QrCodeDto.from({ status: existing.status.value, expiresInSeconds: 0 });
    }

    const instance = existing ?? (await this.createInstance(command.userId));
    const connection = await this.connectOrRecreate(instance);

    if (connection.status === 'connected') {
      instance.syncStatus(ConnectionStatus.CONNECTED, connection.connectedNumber ?? null);
    } else if (connection.qrCodeBase64 || connection.pairingCode) {
      instance.markAwaitingQrCode();
    } else {
      instance.syncStatus(ConnectionStatus.from(connection.status));
    }

    await this.repository.save(instance);

    return QrCodeDto.from({
      status: instance.status.value,
      qrCodeBase64: connection.qrCodeBase64,
      pairingCode: connection.pairingCode,
    });
  }

  /**
   * Pede o QR e, se o provedor disser que a instância não existe mais, recria e tenta uma vez.
   *
   * Isso acontece de verdade: apagar a instância no Evolution Manager (ou perdê-la numa recriação
   * do container) deixava o registro do nosso banco apontando para o vazio — e como o nome da
   * instância deriva do id do usuário, toda tentativa de conectar batia no mesmo 404, sem saída
   * pela interface. O registro é reaproveitado (mesmo id, grupos e histórico preservados); só o
   * token é substituído, porque o antigo morreu com a instância.
   */
  private async connectOrRecreate(instance: WhatsappInstance): ReturnType<
    WhatsappGatewayPort['connect']
  > {
    try {
      return await this.gateway.connect(instance.instanceName.value, instance.token);
    } catch (error) {
      if (!(error instanceof ProviderInstanceMissingException)) {
        throw error;
      }
      this.logger.warn('Instância ausente no provider; recriando', {
        userId: instance.userId,
        instanceName: instance.instanceName.value,
      });

      const { token } = await this.gateway.createInstance(instance.instanceName.value);
      instance.replaceToken(token);
      // Persiste o token novo ANTES de pedir o QR: se o QR falhar, a próxima tentativa já usa o
      // token válido em vez de repetir a recriação.
      await this.repository.save(instance);

      // Uma única retentativa. Um segundo 404 aqui seria outro problema, e insistir esconderia.
      return this.gateway.connect(instance.instanceName.value, token);
    }
  }

  private async createInstance(userId: string): Promise<WhatsappInstance> {
    const instanceName = InstanceName.forUser(userId);
    const { token } = await this.gateway.createInstance(instanceName.value);
    // Nunca logar o token: ele autoriza enviar mensagens pelo WhatsApp do usuário.
    this.logger.log('Instância criada na Evolution', { userId, instanceName: instanceName.value });
    return this.repository.save(WhatsappInstance.create({ userId, instanceName, token }));
  }
}
