import { Body, Controller, Delete, Get, HttpCode, Logger, Post, UseGuards } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_CAPTURE_INSIGHTS, QUEUE_SYNC_MEDIA } from '../../../jobs/jobs.constants';
import { GetConnectionStatusUseCase } from '../../../../contexts/connection/application/use-cases/get-connection-status/get-connection-status.use-case';
import { GetOAuthUrlUseCase } from '../../../../contexts/connection/application/use-cases/get-oauth-url/get-oauth-url.use-case';
import {
  ConnectInstagramCommand,
  ConnectInstagramUseCase,
} from '../../../../contexts/connection/application/use-cases/connect-instagram/connect-instagram.use-case';
import { DisconnectInstagramUseCase } from '../../../../contexts/connection/application/use-cases/disconnect-instagram/disconnect-instagram.use-case';
import { JwtAuthGuard } from '../../../security/guards/jwt-auth.guard';
import { CurrentUser } from '../../../security/decorators/current-user.decorator';
import { AuthTokenPayload } from '../../../security/ports/token-service.port';
import { resolveOwnerId } from '../../../../shared/tenant/tenant';
import { ConnectionCallbackRequestDto } from './dto/connection-request.dto';
import { ConnectionResponseDto, OAuthUrlResponseDto } from './dto/connection-response.dto';

/**
 * The tenant's Instagram connection. Every route is JWT-guarded and owner-scoped: ownerId is
 * always the token `sub`, never a client-supplied value. The access token never leaves the
 * server — no route ever returns it.
 */
@Controller('connection')
@UseGuards(JwtAuthGuard)
export class ConnectionController {
  private readonly logger = new Logger(ConnectionController.name);

  constructor(
    private readonly getConnectionStatusUseCase: GetConnectionStatusUseCase,
    private readonly getOAuthUrlUseCase: GetOAuthUrlUseCase,
    private readonly connectInstagramUseCase: ConnectInstagramUseCase,
    private readonly disconnectInstagramUseCase: DisconnectInstagramUseCase,
    @InjectQueue(QUEUE_SYNC_MEDIA) private readonly syncMediaQueue: Queue,
    @InjectQueue(QUEUE_CAPTURE_INSIGHTS) private readonly captureInsightsQueue: Queue,
  ) {}

  @Get()
  async status(@CurrentUser() user: AuthTokenPayload): Promise<ConnectionResponseDto> {
    const dto = await this.getConnectionStatusUseCase.execute({ ownerId: resolveOwnerId(user) });
    return ConnectionResponseDto.fromDto(dto);
  }

  @Get('oauth-url')
  async oauthUrl(@CurrentUser() user: AuthTokenPayload): Promise<OAuthUrlResponseDto> {
    const result = await this.getOAuthUrlUseCase.execute({ ownerId: resolveOwnerId(user) });
    return OAuthUrlResponseDto.fromResult(result);
  }

  @Post('callback')
  @HttpCode(200)
  async callback(
    @CurrentUser() user: AuthTokenPayload,
    @Body() dto: ConnectionCallbackRequestDto,
  ): Promise<ConnectionResponseDto> {
    const ownerId = resolveOwnerId(user);
    const result = await this.connectInstagramUseCase.execute(
      new ConnectInstagramCommand(ownerId, dto.code),
    );
    // Fire-and-forget: trigger an immediate media sync + insights capture so the dashboard has
    // fresh data right after connecting, instead of waiting for the next scheduled sweep (~4h).
    // Never let a queue/Redis failure break the connection response.
    await this.triggerInitialRefresh(ownerId, result.igUserId);
    return ConnectionResponseDto.fromDto(result);
  }

  /** Enqueues a sync-media job now and a capture-insights job shortly after (so media exist first). */
  private async triggerInitialRefresh(ownerId: string, igUserId: string | null): Promise<void> {
    const data = { ownerId, igUserId: igUserId ?? '' };
    try {
      await this.syncMediaQueue.add('sync-media', data, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 200,
      });
      await this.captureInsightsQueue.add('capture-insights', data, {
        delay: 12_000, // let the media sync land first on a first-time connection
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 200,
      });
    } catch (error) {
      this.logger.warn('Não foi possível enfileirar o refresh inicial pós-conexão', {
        ownerId,
        reason: (error as Error)?.message,
      });
    }
  }

  @Delete()
  @HttpCode(204)
  async disconnect(@CurrentUser() user: AuthTokenPayload): Promise<void> {
    await this.disconnectInstagramUseCase.execute({ ownerId: resolveOwnerId(user) });
  }
}
