import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import {
  LoginCommand,
  LoginUseCase,
} from '../../../../contexts/auth/application/use-cases/login/login.use-case';
import {
  RefreshTokenCommand,
  RefreshTokenUseCase,
} from '../../../../contexts/auth/application/use-cases/refresh/refresh-token.use-case';
import {
  GetMeUseCase,
  GetMeQuery,
} from '../../../../contexts/auth/application/use-cases/me/get-me.use-case';
import {
  RequestPasswordResetUseCase,
  RequestPasswordResetCommand,
} from '../../../../contexts/auth/application/use-cases/request-password-reset/request-password-reset.use-case';
import {
  ResetPasswordUseCase,
  ResetPasswordCommand,
} from '../../../../contexts/auth/application/use-cases/reset-password/reset-password.use-case';
import {
  ChangePasswordUseCase,
  ChangePasswordCommand,
} from '../../../../contexts/auth/application/use-cases/change-password/change-password.use-case';
import { AuthTokenPayload } from '../../../../contexts/auth/application/ports/output/token-service.port';
import { JwtAuthGuard } from '../../../security/guards/jwt-auth.guard';
import { ClientIp, CurrentUser } from '../../../security/decorators/current-user.decorator';
import {
  ChangePasswordRequestDto,
  LoginRequestDto,
  RefreshTokenRequestDto,
  RequestPasswordResetRequestDto,
  ResetPasswordRequestDto,
} from './dto/auth-request.dto';
import { LoginResponseDto, MeResponseDto, RefreshResponseDto } from './dto/auth-response.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly refreshTokenUseCase: RefreshTokenUseCase,
    private readonly getMeUseCase: GetMeUseCase,
    private readonly requestPasswordResetUseCase: RequestPasswordResetUseCase,
    private readonly resetPasswordUseCase: ResetPasswordUseCase,
    private readonly changePasswordUseCase: ChangePasswordUseCase,
  ) {}

  /**
   * PUBLIC — this is where authentication begins, so it cannot require authentication.
   * Protection: opaque failures (no account enumeration), constant-time-ish path, bcrypt cost 12.
   */
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginRequestDto,
    @ClientIp() ip: string | null,
  ): Promise<LoginResponseDto> {
    const result = await this.loginUseCase.execute(new LoginCommand(dto.email, dto.password, ip));
    return LoginResponseDto.from(result);
  }

  /**
   * PUBLIC — the access token is expired by the time this is called, so a JWT guard here would make
   * refresh impossible. The refresh token itself is the credential and is verified as such.
   */
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Body() dto: RefreshTokenRequestDto): Promise<RefreshResponseDto> {
    const result = await this.refreshTokenUseCase.execute(
      new RefreshTokenCommand(dto.refreshToken),
    );
    return RefreshResponseDto.from(result);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: AuthTokenPayload): Promise<MeResponseDto> {
    // Both ids come from the token — the client cannot ask about another user or tenant.
    const me = await this.getMeUseCase.execute(new GetMeQuery(user.sub, user.accountId));
    return MeResponseDto.from(me);
  }

  /**
   * PUBLIC — whoever forgot their password cannot authenticate to ask for a reset.
   *
   * Sends a six-digit code to the user's WhatsApp and ALWAYS answers 204, whether or not the e-mail
   * exists and whether or not the user is active: any difference between those outcomes would turn
   * this into an account-enumeration oracle.
   */
  @Post('request-password-reset')
  @HttpCode(204)
  async requestPasswordReset(
    @Body() dto: RequestPasswordResetRequestDto,
    @ClientIp() ip: string | null,
  ): Promise<void> {
    await this.requestPasswordResetUseCase.execute(new RequestPasswordResetCommand(dto.email, ip));
  }

  /**
   * PUBLIC — the person resetting cannot log in by definition. The code that arrived on WhatsApp is
   * the credential: single use, 15 minutes, five attempts, and every refusal answers identically.
   */
  @Post('reset-password')
  @HttpCode(204)
  async resetPassword(
    @Body() dto: ResetPasswordRequestDto,
    @ClientIp() ip: string | null,
  ): Promise<void> {
    await this.resetPasswordUseCase.execute(
      new ResetPasswordCommand(dto.email, dto.code, dto.newPassword, ip),
    );
  }

  /** Authenticated: a user changing their own password, proving they know the current one. */
  @Post('change-password')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @Body() dto: ChangePasswordRequestDto,
    @CurrentUser() user: AuthTokenPayload,
  ): Promise<void> {
    await this.changePasswordUseCase.execute(
      new ChangePasswordCommand(user.sub, dto.currentPassword, dto.newPassword),
    );
  }
}
