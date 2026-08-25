import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CreateChannelUseCase } from '../../../../contexts/channel/application/use-cases/create-channel/create-channel.use-case';
import { CreateChannelCommand } from '../../../../contexts/channel/application/use-cases/create-channel/create-channel.command';
import { ListChannelsUseCase } from '../../../../contexts/channel/application/use-cases/list-channels/list-channels.use-case';
import { ListChannelsQuery } from '../../../../contexts/channel/application/use-cases/list-channels/list-channels.query';
import { GetChannelUseCase } from '../../../../contexts/channel/application/use-cases/get-channel/get-channel.use-case';
import { GetChannelQuery } from '../../../../contexts/channel/application/use-cases/get-channel/get-channel.query';
import { GetChannelQrCodeUseCase } from '../../../../contexts/channel/application/use-cases/get-channel-qrcode/get-channel-qrcode.use-case';
import { GetChannelQrCodeQuery } from '../../../../contexts/channel/application/use-cases/get-channel-qrcode/get-channel-qrcode.query';
import { SyncConnectionStateUseCase } from '../../../../contexts/channel/application/use-cases/sync-connection-state/sync-connection-state.use-case';
import { DiagnoseWebhookUseCase } from '../../../../contexts/channel/application/use-cases/diagnose-webhook/diagnose-webhook.use-case';
import { DiagnoseWebhookCommand } from '../../../../contexts/channel/application/use-cases/diagnose-webhook/diagnose-webhook.command';
import { SyncConnectionStateCommand } from '../../../../contexts/channel/application/use-cases/sync-connection-state/sync-connection-state.command';
import { UpdateQuotaBandUseCase } from '../../../../contexts/channel/application/use-cases/update-quota-band/update-quota-band.use-case';
import { UpdateQuotaBandCommand } from '../../../../contexts/channel/application/use-cases/update-quota-band/update-quota-band.command';
import { DisconnectChannelUseCase } from '../../../../contexts/channel/application/use-cases/disconnect-channel/disconnect-channel.use-case';
import { DisconnectChannelCommand } from '../../../../contexts/channel/application/use-cases/disconnect-channel/disconnect-channel.command';
import { RetireChannelUseCase } from '../../../../contexts/channel/application/use-cases/retire-channel/retire-channel.use-case';
import { RetireChannelCommand } from '../../../../contexts/channel/application/use-cases/retire-channel/retire-channel.command';
import { MarkChannelBannedUseCase } from '../../../../contexts/channel/application/use-cases/mark-channel-banned/mark-channel-banned.use-case';
import { MarkChannelBannedCommand } from '../../../../contexts/channel/application/use-cases/mark-channel-banned/mark-channel-banned.command';
import { ReinstateChannelUseCase } from '../../../../contexts/channel/application/use-cases/reinstate-channel/reinstate-channel.use-case';
import { ReinstateChannelCommand } from '../../../../contexts/channel/application/use-cases/reinstate-channel/reinstate-channel.command';
import { GetChannelHealthUseCase } from '../../../../contexts/channel/application/use-cases/get-channel-health/get-channel-health.use-case';
import { GetChannelHealthQuery } from '../../../../contexts/channel/application/use-cases/get-channel-health/get-channel-health.query';
import { AuthTokenPayload } from '../../../../contexts/auth/application/ports/output/token-service.port';
import { AccountAdminGuard } from '../../../security/guards/account-admin.guard';
import { JwtAuthGuard } from '../../../security/guards/jwt-auth.guard';
import { ClientIp, CurrentUser } from '../../../security/decorators/current-user.decorator';
import {
  ChannelHealthQueryDto,
  CreateChannelRequestDto,
  ListChannelsQueryDto,
  TerminalStateRequestDto,
  UpdateQuotaBandRequestDto,
  WebhookDiagnosisRequestDto,
} from './dto/channel-request.dto';
import {
  ChannelHealthResponseDto,
  ChannelResponseDto,
  WebhookDiagnosisResponseDto,
  QrCodeResponseDto,
} from './dto/channel-response.dto';

/**
 * Channels of the current account (§5, FASE 2 item 1).
 *
 * Guard placement follows Least Privilege: reading channels and their health is fine for any
 * authenticated user of the account, but everything that changes a chip — provisioning, pairing,
 * quota band, disconnect, and the two terminal declarations — is ACCOUNT_ADMIN only.
 *
 * Note what is NOT here: no endpoint sets `current_quota` (it belongs to the daily job, §2.1), and
 * no endpoint returns the Evolution instance name (infrastructure detail).
 */
@Controller('channels')
@UseGuards(JwtAuthGuard)
export class ChannelController {
  constructor(
    private readonly createChannel: CreateChannelUseCase,
    private readonly listChannels: ListChannelsUseCase,
    private readonly getChannel: GetChannelUseCase,
    private readonly getQrCode: GetChannelQrCodeUseCase,
    private readonly syncState: SyncConnectionStateUseCase,
    private readonly diagnoseWebhook: DiagnoseWebhookUseCase,
    private readonly updateQuotaBand: UpdateQuotaBandUseCase,
    private readonly disconnectChannel: DisconnectChannelUseCase,
    private readonly retireChannel: RetireChannelUseCase,
    private readonly markBanned: MarkChannelBannedUseCase,
    private readonly reinstateChannel: ReinstateChannelUseCase,
    private readonly getHealth: GetChannelHealthUseCase,
  ) {}

  @Get()
  async list(
    @Query() query: ListChannelsQueryDto,
    @CurrentUser() user: AuthTokenPayload,
  ): Promise<ChannelResponseDto[]> {
    const channels = await this.listChannels.execute(
      new ListChannelsQuery(user.accountId, query.status),
    );
    return channels.map((channel) => ChannelResponseDto.from(channel));
  }

  @Get(':id')
  async get(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthTokenPayload,
  ): Promise<ChannelResponseDto> {
    const channel = await this.getChannel.execute(new GetChannelQuery(user.accountId, id));
    return ChannelResponseDto.from(channel);
  }

  @Post()
  @HttpCode(201)
  @UseGuards(AccountAdminGuard)
  async create(
    @Body() dto: CreateChannelRequestDto,
    @CurrentUser() user: AuthTokenPayload,
    @ClientIp() ip: string | null,
  ): Promise<ChannelResponseDto> {
    const channel = await this.createChannel.execute(
      new CreateChannelCommand(
        user.accountId,
        user.sub,
        dto.label,
        dto.phone,
        dto.quotaFloor ?? null,
        dto.quotaCeiling ?? null,
        ip,
      ),
    );
    return ChannelResponseDto.from(channel);
  }

  /** Pairing: the UI polls this until `qrCodeBase64` is empty and the status is CONNECTED. */
  @Get(':id/qrcode')
  @UseGuards(AccountAdminGuard)
  async qrCode(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthTokenPayload,
  ): Promise<QrCodeResponseDto> {
    const qr = await this.getQrCode.execute(new GetChannelQrCodeQuery(user.accountId, id));
    return QrCodeResponseDto.from(qr);
  }

  /**
   * O que a Evolution tem configurado de verdade para este canal.
   *
   * Diagnóstico, e existe porque "a resposta não chegou" tem cinco causas indistinguíveis de fora —
   * sem webhook, webhook desabilitado, webhook sem o cabeçalho de autenticação (401 e a Evolution
   * desiste), webhook sem `MESSAGES_UPSERT`, ou URL errada. Todas parecem "ninguém respondeu".
   *
   * `POST` e não `GET` porque a variante que reconfigura muda estado no provedor; o corpo diz qual das
   * duas é. Separado do `sync-state` de propósito: ler sem consertar é o que permite VER o defeito.
   */
  @Post(':id/webhook-diagnosis')
  @HttpCode(200)
  @UseGuards(AccountAdminGuard)
  async webhookDiagnosis(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: WebhookDiagnosisRequestDto,
    @CurrentUser() user: AuthTokenPayload,
  ): Promise<WebhookDiagnosisResponseDto> {
    const diagnosis = await this.diagnoseWebhook.execute(
      new DiagnoseWebhookCommand(user.accountId, id, dto.reconfigure ?? false),
    );
    return WebhookDiagnosisResponseDto.from(diagnosis);
  }

  /** Reconciles with the provider. Safe to call at will; it is also run by a scheduled job. */
  @Post(':id/sync-state')
  @HttpCode(200)
  async sync(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthTokenPayload,
  ): Promise<ChannelResponseDto> {
    const channel = await this.syncState.execute(
      new SyncConnectionStateCommand(user.accountId, id),
    );
    return ChannelResponseDto.from(channel);
  }

  @Patch(':id/quota-band')
  @UseGuards(AccountAdminGuard)
  async quotaBand(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateQuotaBandRequestDto,
    @CurrentUser() user: AuthTokenPayload,
    @ClientIp() ip: string | null,
  ): Promise<ChannelResponseDto> {
    const channel = await this.updateQuotaBand.execute(
      new UpdateQuotaBandCommand(
        user.accountId,
        user.sub,
        id,
        dto.quotaFloor,
        dto.quotaCeiling,
        ip,
      ),
    );
    return ChannelResponseDto.from(channel);
  }

  /** Transient: this is how a chip is re-paired on another phone. Never enables migration. */
  @Post(':id/disconnect')
  @HttpCode(200)
  @UseGuards(AccountAdminGuard)
  async disconnect(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthTokenPayload,
    @ClientIp() ip: string | null,
  ): Promise<ChannelResponseDto> {
    const channel = await this.disconnectChannel.execute(
      new DisconnectChannelCommand(user.accountId, user.sub, id, ip),
    );
    return ChannelResponseDto.from(channel);
  }

  /** TERMINAL, human-declared, reason + confirmation required (§5, FASE 2 item 5). */
  @Post(':id/retire')
  @HttpCode(200)
  @UseGuards(AccountAdminGuard)
  async retire(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TerminalStateRequestDto,
    @CurrentUser() user: AuthTokenPayload,
    @ClientIp() ip: string | null,
  ): Promise<ChannelResponseDto> {
    const channel = await this.retireChannel.execute(
      new RetireChannelCommand(user.accountId, user.sub, id, dto.reason, ip),
    );
    return ChannelResponseDto.from(channel);
  }

  /**
   * TERMINAL, human-declared. There is no automatic ban detection anywhere in the system and there
   * must not be: WhatsApp never tells you (§2.1). A person confirms the block and records it here.
   */
  @Post(':id/mark-banned')
  @HttpCode(200)
  @UseGuards(AccountAdminGuard)
  async banned(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TerminalStateRequestDto,
    @CurrentUser() user: AuthTokenPayload,
    @ClientIp() ip: string | null,
  ): Promise<ChannelResponseDto> {
    const channel = await this.markBanned.execute(
      new MarkChannelBannedCommand(user.accountId, user.sub, id, dto.reason, ip),
    );
    return ChannelResponseDto.from(channel);
  }

  /** Lifts a DEGRADED channel after a human reviewed it. Not terminal, not automatic. */
  @Post(':id/reinstate')
  @HttpCode(200)
  @UseGuards(AccountAdminGuard)
  async reinstate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthTokenPayload,
    @ClientIp() ip: string | null,
  ): Promise<ChannelResponseDto> {
    const channel = await this.reinstateChannel.execute(
      new ReinstateChannelCommand(user.accountId, user.sub, id, ip),
    );
    return ChannelResponseDto.from(channel);
  }

  @Get(':id/health')
  async health(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ChannelHealthQueryDto,
    @CurrentUser() user: AuthTokenPayload,
  ): Promise<ChannelHealthResponseDto> {
    const health = await this.getHealth.execute(
      new GetChannelHealthQuery(user.accountId, id, query.days),
    );
    return ChannelHealthResponseDto.from(health);
  }
}
