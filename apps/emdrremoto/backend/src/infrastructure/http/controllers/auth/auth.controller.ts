import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../security/guards/jwt-auth.guard';
import { CurrentUser } from '../../../security/decorators/current-user.decorator';
import { AuthTokenPayload } from '../../../security/ports/token-service.port';
import {
  LoginPsicologoUseCase,
  LoginPsicologoCommand,
} from '../../../../contexts/auth/application/use-cases/login-psicologo/login-psicologo.use-case';
import {
  RefreshTokenUseCase,
  RefreshTokenCommand,
} from '../../../../contexts/auth/application/use-cases/refresh-token/refresh-token.use-case';
import {
  RequestPasswordResetUseCase,
  RequestPasswordResetCommand,
} from '../../../../contexts/auth/application/use-cases/request-password-reset/request-password-reset.use-case';
import {
  ResetPasswordUseCase,
  ResetPasswordCommand,
} from '../../../../contexts/auth/application/use-cases/reset-password/reset-password.use-case';
import {
  PacienteSessionAccessUseCase,
  PacienteSessionAccessCommand,
} from '../../../../contexts/auth/application/use-cases/paciente-session-access/paciente-session-access.use-case';
import {
  GetMeUseCase,
  GetMeQuery,
} from '../../../../contexts/auth/application/use-cases/get-me/get-me.use-case';
import {
  LoginResultDto,
  PacienteAccessResultDto,
  TokensDto,
} from '../../../../contexts/auth/application/dto/auth-result.dto';
import { PsicologoDto } from '../../../../contexts/psicologo/application/dto/psicologo.dto';
import {
  LoginRequestDto,
  PacienteAccessRequestDto,
  RefreshRequestDto,
  RequestResetRequestDto,
  ResetPasswordRequestDto,
} from './dto/auth.request.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly loginPsicologo: LoginPsicologoUseCase,
    private readonly refreshToken: RefreshTokenUseCase,
    private readonly requestReset: RequestPasswordResetUseCase,
    private readonly resetPassword: ResetPasswordUseCase,
    private readonly pacienteAccess: PacienteSessionAccessUseCase,
    private readonly getMe: GetMeUseCase,
  ) {}

  // Público: autenticação do psicólogo (emite tokens próprios). Sem guard por natureza.
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginRequestDto): Promise<LoginResultDto> {
    return this.loginPsicologo.execute(new LoginPsicologoCommand(dto.email, dto.senha));
  }

  // Público: renova o access token a partir de um refresh token válido.
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Body() dto: RefreshRequestDto): Promise<TokensDto> {
    return this.refreshToken.execute(new RefreshTokenCommand(dto.refreshToken));
  }

  // Público: dispara e-mail com código de recuperação. Resposta sempre 200 (não vaza existência).
  @Post('request-password-reset')
  @HttpCode(200)
  async requestPasswordReset(@Body() dto: RequestResetRequestDto): Promise<{ ok: true }> {
    await this.requestReset.execute(new RequestPasswordResetCommand(dto.email));
    return { ok: true };
  }

  // Público: troca a senha usando o código de recuperação.
  @Post('reset-password')
  @HttpCode(200)
  async reset(@Body() dto: ResetPasswordRequestDto): Promise<{ ok: true }> {
    await this.resetPassword.execute(new ResetPasswordCommand(dto.code, dto.senha));
    return { ok: true };
  }

  // Público: o paciente troca o hash de convite por um token de sessão (sem senha).
  @Post('paciente/session-access')
  @HttpCode(200)
  async pacienteSessionAccess(
    @Body() dto: PacienteAccessRequestDto,
  ): Promise<PacienteAccessResultDto> {
    return this.pacienteAccess.execute(new PacienteSessionAccessCommand(dto.hash));
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: AuthTokenPayload): Promise<PsicologoDto> {
    return this.getMe.execute(new GetMeQuery(user.sub));
  }
}
