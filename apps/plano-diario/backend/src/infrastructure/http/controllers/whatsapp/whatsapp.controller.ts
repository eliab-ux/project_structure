import { Controller, Delete, Get, HttpCode, Logger, Post, Query, UseGuards } from '@nestjs/common';
import { ConnectWhatsappUseCase } from '../../../../contexts/whatsapp/application/use-cases/connect-whatsapp/connect-whatsapp.use-case';
import { DeleteInstanceUseCase } from '../../../../contexts/whatsapp/application/use-cases/delete-instance/delete-instance.use-case';
import { DisconnectWhatsappUseCase } from '../../../../contexts/whatsapp/application/use-cases/disconnect-whatsapp/disconnect-whatsapp.use-case';
import { GetConnectionStateUseCase } from '../../../../contexts/whatsapp/application/use-cases/get-connection-state/get-connection-state.use-case';
import { ListGroupsUseCase } from '../../../../contexts/whatsapp/application/use-cases/list-groups/list-groups.use-case';
import { CurrentUser } from '../../../security/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../security/guards/jwt-auth.guard';
import { AuthTokenPayload } from '../../../security/ports/token-service.port';
import { ListGroupsQueryDto } from './dto/whatsapp-request.dto';
import {
  GroupListResponseDto,
  InstanceResponseDto,
  QrCodeResponseDto,
} from './dto/whatsapp-response.dto';

/**
 * Conexão do WhatsApp do usuário. Guard no nível do controller: todo endpoint aqui mexe na
 * conexão de uma conta específica.
 *
 * O `userId` vem SEMPRE de `payload.sub` (o JWT), nunca de body/query/param — é isso que impede
 * um usuário autenticado de gerar QR, desconectar ou apagar a instância de outro.
 */
@Controller('whatsapp')
@UseGuards(JwtAuthGuard)
export class WhatsappController {
  private readonly logger = new Logger(WhatsappController.name);

  constructor(
    private readonly connectWhatsappUseCase: ConnectWhatsappUseCase,
    private readonly getConnectionStateUseCase: GetConnectionStateUseCase,
    private readonly disconnectWhatsappUseCase: DisconnectWhatsappUseCase,
    private readonly deleteInstanceUseCase: DeleteInstanceUseCase,
    private readonly listGroupsUseCase: ListGroupsUseCase,
  ) {}

  /**
   * Grupos do WhatsApp conectado. Lê do cache; `?refresh=true` força ir ao provider.
   * Só devolve os grupos DESTE usuário — o `userId` vem do token.
   */
  @Get('groups')
  async groups(
    @CurrentUser() user: AuthTokenPayload,
    @Query() query: ListGroupsQueryDto,
  ): Promise<GroupListResponseDto> {
    return GroupListResponseDto.fromDto(
      await this.listGroupsUseCase.execute({ userId: user.sub, refresh: query.shouldRefresh }),
    );
  }

  /** Cria a instância (se não existir) e devolve o QR Code. Idempotente por usuário. */
  @Post('instance')
  @HttpCode(201)
  async createInstance(@CurrentUser() user: AuthTokenPayload): Promise<QrCodeResponseDto> {
    const qr = await this.connectWhatsappUseCase.execute({ userId: user.sub });
    this.logger.log('Conexão de WhatsApp iniciada', { userId: user.sub, status: qr.status });
    return QrCodeResponseDto.fromDto(qr);
  }

  /** Gera um QR novo — o anterior expira em ~60s. */
  @Get('instance/qrcode')
  async qrCode(@CurrentUser() user: AuthTokenPayload): Promise<QrCodeResponseDto> {
    return QrCodeResponseDto.fromDto(
      await this.connectWhatsappUseCase.execute({ userId: user.sub }),
    );
  }

  @Get('instance')
  async instance(@CurrentUser() user: AuthTokenPayload): Promise<InstanceResponseDto> {
    return InstanceResponseDto.fromDto(
      await this.getConnectionStateUseCase.execute({ userId: user.sub }),
    );
  }

  /** Endpoint do polling da tela de QR (a cada 3s). */
  @Get('instance/status')
  async status(@CurrentUser() user: AuthTokenPayload): Promise<InstanceResponseDto> {
    return InstanceResponseDto.fromDto(
      await this.getConnectionStateUseCase.execute({ userId: user.sub }),
    );
  }

  /** Desconecta mantendo a instância — pode parear de novo por QR. */
  @Post('instance/logout')
  @HttpCode(204)
  async logout(@CurrentUser() user: AuthTokenPayload): Promise<void> {
    await this.disconnectWhatsappUseCase.execute({ userId: user.sub });
    this.logger.log('WhatsApp desconectado', { userId: user.sub });
  }

  /** Remove a conexão por completo (apaga a instância na Evolution). */
  @Delete('instance')
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthTokenPayload): Promise<void> {
    await this.deleteInstanceUseCase.execute({ userId: user.sub });
    this.logger.log('Instância de WhatsApp removida', { userId: user.sub });
  }
}
