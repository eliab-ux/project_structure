import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../security/guards/jwt-auth.guard';
import { PsicologoGuard } from '../../../security/guards/psicologo.guard';
import { CurrentUser } from '../../../security/decorators/current-user.decorator';
import { AuthTokenPayload } from '../../../security/ports/token-service.port';
import {
  CreateSessionUseCase,
  CreateSessionCommand,
} from '../../../../contexts/session/application/use-cases/create-session/create-session.use-case';
import {
  GetSessionInfoUseCase,
  GetSessionInfoQuery,
  SessionInfoResult,
} from '../../../../contexts/session/application/use-cases/get-session-info/get-session-info.use-case';
import {
  EndSessionUseCase,
  EndSessionCommand,
} from '../../../../contexts/session/application/use-cases/end-session/end-session.use-case';
import {
  GetSessionInviteUseCase,
  GetSessionInviteQuery,
  SessionInviteResult,
} from '../../../../contexts/session/application/use-cases/get-session-invite/get-session-invite.use-case';
import {
  SendSessionLinkUseCase,
  SendSessionLinkCommand,
  SendSessionLinkResult,
} from '../../../../contexts/session/application/use-cases/send-session-link/send-session-link.use-case';
import { SessionDto } from '../../../../contexts/session/application/dto/session.dto';
import { CreateSessionRequestDto } from './dto/create-session.request.dto';
import { SendLinkRequestDto } from './dto/send-link.request.dto';

@Controller('sessions')
export class SessionController {
  constructor(
    private readonly createSession: CreateSessionUseCase,
    private readonly getSessionInfo: GetSessionInfoUseCase,
    private readonly endSession: EndSessionUseCase,
    private readonly getInvite: GetSessionInviteUseCase,
    private readonly sendLink: SendSessionLinkUseCase,
  ) {}

  @Post()
  @UseGuards(PsicologoGuard)
  @HttpCode(201)
  async create(
    @Body() dto: CreateSessionRequestDto,
    @CurrentUser() user: AuthTokenPayload,
  ): Promise<SessionDto> {
    return this.createSession.execute(new CreateSessionCommand(user.sub, dto.pacienteId));
  }

  // Cria uma sessão e envia o link ao paciente pelo canal escolhido (WhatsApp ou e-mail).
  @Post('send-link')
  @UseGuards(PsicologoGuard)
  @HttpCode(200)
  async sendSessionLink(
    @Body() dto: SendLinkRequestDto,
    @CurrentUser() user: AuthTokenPayload,
  ): Promise<SendSessionLinkResult> {
    return this.sendLink.execute(new SendSessionLinkCommand(user.sub, dto.pacienteId, dto.channel));
  }

  // Prejoin/sala: só um participante pode ler. Retorna também os nomes (telas de espera/presença).
  @Get(':code')
  @UseGuards(JwtAuthGuard)
  async getByCode(
    @Param('code') code: string,
    @CurrentUser() user: AuthTokenPayload,
  ): Promise<SessionInfoResult> {
    return this.getSessionInfo.execute(new GetSessionInfoQuery(user.sub, user.role, code));
  }

  // Link de convite do paciente — só o psicólogo dono da sessão (contém credencial/hash).
  @Get(':code/invite')
  @UseGuards(PsicologoGuard)
  async invite(
    @Param('code') code: string,
    @CurrentUser() user: AuthTokenPayload,
  ): Promise<SessionInviteResult> {
    return this.getInvite.execute(new GetSessionInviteQuery(user.sub, code));
  }

  @Post(':code/end')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async end(
    @Param('code') code: string,
    @CurrentUser() user: AuthTokenPayload,
  ): Promise<{ ok: true }> {
    await this.endSession.execute(new EndSessionCommand(user.sub, user.role, code));
    return { ok: true };
  }
}
