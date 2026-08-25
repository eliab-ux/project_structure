import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  GatewayConnectionState,
  WHATSAPP_GATEWAY,
  WhatsAppGatewayPort,
} from '../../../../../infrastructure/whatsapp/ports/whatsapp-gateway.port';
import { ChannelId } from '../../../domain/value-objects/channel-id.vo';
import { ChannelStatus } from '../../../domain/value-objects/channel-status.vo';
import { ChannelNotFoundException } from '../../../domain/exceptions/channel-not-found.exception';
import { ChannelInTerminalStateException } from '../../../domain/exceptions/invalid-channel-transition.exception';
import { QrCodeDto } from '../../dto/channel.dto';
import {
  CHANNEL_REPOSITORY,
  ChannelRepositoryPort,
} from '../../ports/output/channel-repository.port';
import { GetChannelQrCodeQuery } from './get-channel-qrcode.query';

/**
 * Fetches a fresh QR for pairing. Always live from the gateway — a QR expires in seconds, so
 * caching one would only ever serve a code that no longer works.
 *
 * It also reconciles: if the instance reports OPEN, the channel is already paired and the answer is
 * "connected" rather than a QR nobody needs to scan.
 */
@Injectable()
export class GetChannelQrCodeUseCase implements UseCase<GetChannelQrCodeQuery, QrCodeDto> {
  private readonly logger = new Logger(GetChannelQrCodeUseCase.name);

  constructor(
    @Inject(CHANNEL_REPOSITORY) private readonly channels: ChannelRepositoryPort,
    @Inject(WHATSAPP_GATEWAY) private readonly gateway: WhatsAppGatewayPort,
  ) {}

  async execute(query: GetChannelQrCodeQuery): Promise<QrCodeDto> {
    const channel = await this.channels.findById(ChannelId.from(query.channelId));
    if (!channel) {
      throw new ChannelNotFoundException();
    }
    if (channel.isTerminal) {
      throw new ChannelInTerminalStateException(channel.status);
    }

    const instance = {
      instanceName: channel.evolutionInstanceName,
      accountId: channel.accountId,
    };

    const state = await this.gateway.getConnectionState(instance);
    const dto = new QrCodeDto();

    if (state === GatewayConnectionState.OPEN) {
      // Already paired — record it and tell the UI to stop polling.
      channel.markConnected();
      const saved = await this.channels.save(channel);
      dto.status = saved.status;
      dto.qrCodeBase64 = '';
      dto.pairingCode = null;
      return dto;
    }

    const qr = await this.gateway.getQrCode(instance);
    if (channel.status === ChannelStatus.PROVISIONING) {
      channel.markAwaitingQr();
      await this.channels.save(channel);
    }

    dto.status = channel.status;
    dto.qrCodeBase64 = qr.base64;
    dto.pairingCode = qr.pairingCode;
    this.logger.debug('QR solicitado', { channelId: channel.id.value });
    return dto;
  }
}
