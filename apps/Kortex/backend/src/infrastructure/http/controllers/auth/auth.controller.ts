import { Body, Controller, Get, HttpCode, Patch, Post, UseGuards } from '@nestjs/common';
import {
  LoginUseCase,
  LoginCommand,
} from '../../../../contexts/auth/application/use-cases/login/login.use-case';
import {
  RefreshTokenUseCase,
  RefreshTokenCommand,
} from '../../../../contexts/auth/application/use-cases/refresh-token/refresh-token.use-case';
import {
  GetMeUseCase,
  GetMeQuery,
} from '../../../../contexts/auth/application/use-cases/get-me/get-me.use-case';
import {
  ChangePasswordUseCase,
  ChangePasswordCommand,
} from '../../../../contexts/auth/application/use-cases/change-password/change-password.use-case';
import {
  RequestPasswordResetUseCase,
  RequestPasswordResetCommand,
} from '../../../../contexts/auth/application/use-cases/request-password-reset/request-password-reset.use-case';
import {
  ResetPasswordUseCase,
  ResetPasswordCommand,
} from '../../../../contexts/auth/application/use-cases/reset-password/reset-password.use-case';
import {
  ChangeOwnPhoneUseCase,
  ChangeOwnPhoneCommand,
} from '../../../../contexts/user/application/use-cases/change-own-phone/change-own-phone.use-case';
import {
  AuthSessionDto,
  AuthenticatedUserDto,
} from '../../../../contexts/auth/application/dto/authenticated-user.dto';
import { UserDto } from '../../../../contexts/user/application/dto/user.dto';
import { AuthTokenPayload } from '../../../../contexts/auth/application/ports/output/token-service.port';
import { PlainPassword } from '../../../../shared/domain/value-objects/plain-password.vo';
import { JwtAuthGuard } from '../../../security/guards/jwt-auth.guard';
import { CurrentUser } from '../../../security/decorators/current-user.decorator';
import {
  ChangeOwnPhoneRequestDto,
  ChangePasswordRequestDto,
  LoginRequestDto,
  RefreshTokenRequestDto,
  RequestPasswordResetRequestDto,
  ResetPasswordRequestDto,
} from './dto/auth-request.dto';

/**
 * Quatro rotas públicas e o motivo de cada uma: `login`, `refresh`,
 * `request-password-reset` e `reset-password` são exatamente os pontos em que o chamador ainda
 * não pode estar autenticado. `me` e `change-password` exigem token.
 */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly refreshTokenUseCase: RefreshTokenUseCase,
    private readonly getMeUseCase: GetMeUseCase,
    private readonly changePasswordUseCase: ChangePasswordUseCase,
    private readonly requestPasswordResetUseCase: RequestPasswordResetUseCase,
    private readonly resetPasswordUseCase: ResetPasswordUseCase,
    private readonly changeOwnPhoneUseCase: ChangeOwnPhoneUseCase,
  ) {}

  // Rota PÚBLICA — é onde a autenticação começa. @UseGuards intencionalmente ausente.
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginRequestDto): Promise<AuthSessionDto> {
    return this.loginUseCase.execute(
      new LoginCommand(dto.email, PlainPassword.create(dto.password)),
    );
  }

  // Rota PÚBLICA — o access token já expirou; o refresh token é a credencial aqui.
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Body() dto: RefreshTokenRequestDto): Promise<AuthSessionDto> {
    return this.refreshTokenUseCase.execute(new RefreshTokenCommand(dto.refreshToken));
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: AuthTokenPayload): Promise<AuthenticatedUserDto> {
    return this.getMeUseCase.execute(new GetMeQuery(user.accountId, user.sub));
  }

  /**
   * Cada pessoa mantém o próprio telefone (spec §6.12). Vive aqui, e não em `/users`, porque o
   * `UserController` é protegido por `AdminGuard` — e o Modelista, que troca de chip como
   * qualquer um, precisa alcançar esta rota para não depender de terceiro pelo canal que
   * recupera a própria senha.
   */
  @Patch('me/phone')
  @UseGuards(JwtAuthGuard)
  async changeOwnPhone(
    @CurrentUser() user: AuthTokenPayload,
    @Body() dto: ChangeOwnPhoneRequestDto,
  ): Promise<UserDto> {
    return this.changeOwnPhoneUseCase.execute(
      new ChangeOwnPhoneCommand(user.accountId, user.sub, dto.phone),
    );
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(204)
  async changePassword(
    @CurrentUser() user: AuthTokenPayload,
    @Body() dto: ChangePasswordRequestDto,
  ): Promise<void> {
    await this.changePasswordUseCase.execute(
      new ChangePasswordCommand(
        user.accountId,
        // O alvo é sempre o próprio usuário do token: não existe caminho para trocar a senha de
        // outra pessoa, nem para o Administrativo.
        user.sub,
        PlainPassword.create(dto.currentPassword),
        PlainPassword.create(dto.newPassword),
      ),
    );
  }

  /**
   * Rota PÚBLICA — quem esqueceu a senha não tem como se autenticar.
   *
   * Responde **204 sempre**: e-mail existente, inexistente, usuário inativo, cota da hora
   * estourada ou canal do WhatsApp fora do ar. Qualquer diferença observável aqui transformaria
   * esta rota num verificador de quem trabalha na empresa.
   */
  @Post('request-password-reset')
  @HttpCode(204)
  async requestPasswordReset(@Body() dto: RequestPasswordResetRequestDto): Promise<void> {
    await this.requestPasswordResetUseCase.execute(new RequestPasswordResetCommand(dto.email));
  }

  // Rota PÚBLICA — a credencial é o código de 6 dígitos recebido no WhatsApp.
  @Post('reset-password')
  @HttpCode(204)
  async resetPassword(@Body() dto: ResetPasswordRequestDto): Promise<void> {
    await this.resetPasswordUseCase.execute(
      new ResetPasswordCommand(dto.email, dto.code, PlainPassword.create(dto.newPassword)),
    );
  }
}
