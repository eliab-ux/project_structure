import { Body, Controller, Delete, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { PsicologoGuard } from '../../../security/guards/psicologo.guard';
import { CurrentUser } from '../../../security/decorators/current-user.decorator';
import { AuthTokenPayload } from '../../../security/ports/token-service.port';
import {
  SetupWhatsappUseCase,
  SetupWhatsappCommand,
} from '../../../../contexts/whatsapp/application/use-cases/setup-whatsapp/setup-whatsapp.use-case';
import {
  GetWhatsappStatusUseCase,
  GetWhatsappStatusQuery,
} from '../../../../contexts/whatsapp/application/use-cases/get-whatsapp-status/get-whatsapp-status.use-case';
import {
  DisconnectWhatsappUseCase,
  DisconnectWhatsappCommand,
} from '../../../../contexts/whatsapp/application/use-cases/disconnect-whatsapp/disconnect-whatsapp.use-case';
import { WhatsappStatusDto } from '../../../../contexts/whatsapp/application/dto/whatsapp-status.dto';
import { SetupWhatsappRequestDto } from './dto/setup-whatsapp.request.dto';

@Controller('whatsapp')
@UseGuards(PsicologoGuard)
export class WhatsappController {
  constructor(
    private readonly setupWhatsapp: SetupWhatsappUseCase,
    private readonly getStatus: GetWhatsappStatusUseCase,
    private readonly disconnectWhatsapp: DisconnectWhatsappUseCase,
  ) {}

  @Get('status')
  async status(@CurrentUser() user: AuthTokenPayload): Promise<WhatsappStatusDto> {
    return this.getStatus.execute(new GetWhatsappStatusQuery(user.sub));
  }

  @Post('setup')
  @HttpCode(200)
  async setup(
    @Body() dto: SetupWhatsappRequestDto,
    @CurrentUser() user: AuthTokenPayload,
  ): Promise<WhatsappStatusDto> {
    return this.setupWhatsapp.execute(new SetupWhatsappCommand(user.sub, dto.mode));
  }

  @Delete()
  @HttpCode(204)
  async disconnect(@CurrentUser() user: AuthTokenPayload): Promise<void> {
    await this.disconnectWhatsapp.execute(new DisconnectWhatsappCommand(user.sub));
  }
}
