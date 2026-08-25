import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { RegisterUserUseCase } from '../../../../contexts/user/application/use-cases/register-user/register-user.use-case';
import { RegisterUserCommand } from '../../../../contexts/user/application/use-cases/register-user/register-user.command';
import { GetMeUseCase } from '../../../../contexts/user/application/use-cases/get-me/get-me.use-case';
import { LoginUseCase } from '../../../../contexts/auth/application/use-cases/login/login.use-case';
import { LoginCommand } from '../../../../contexts/auth/application/use-cases/login/login.command';
import { RefreshTokenUseCase } from '../../../../contexts/auth/application/use-cases/refresh/refresh-token.use-case';
import { RequestPasswordResetUseCase } from '../../../../contexts/auth/application/use-cases/request-password-reset/request-password-reset.use-case';
import {
  ResetPasswordCommand,
  ResetPasswordUseCase,
} from '../../../../contexts/auth/application/use-cases/reset-password/reset-password.use-case';
import { JwtAuthGuard } from '../../../security/guards/jwt-auth.guard';
import { CurrentUser } from '../../../security/decorators/current-user.decorator';
import { AuthTokenPayload } from '../../../security/ports/token-service.port';
import {
  LoginRequestDto,
  RefreshRequestDto,
  RegisterRequestDto,
  RequestPasswordResetDto,
  ResetPasswordRequestDto,
} from './dto/auth-request.dto';
import { TokensResponseDto, UserResponseDto } from './dto/auth-response.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerUserUseCase: RegisterUserUseCase,
    private readonly getMeUseCase: GetMeUseCase,
    private readonly loginUseCase: LoginUseCase,
    private readonly refreshTokenUseCase: RefreshTokenUseCase,
    private readonly requestPasswordResetUseCase: RequestPasswordResetUseCase,
    private readonly resetPasswordUseCase: ResetPasswordUseCase,
  ) {}

  // Público: criação de conta local (self-service SaaS).
  @Post('register')
  @HttpCode(201)
  async register(@Body() dto: RegisterRequestDto): Promise<UserResponseDto> {
    const user = await this.registerUserUseCase.execute(
      new RegisterUserCommand(dto.name, dto.email, dto.password),
    );
    return UserResponseDto.fromDto(user);
  }

  // Público: login local emite os tokens próprios.
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginRequestDto): Promise<TokensResponseDto> {
    const tokens = await this.loginUseCase.execute(new LoginCommand(dto.email, dto.password));
    return TokensResponseDto.fromTokens(tokens);
  }

  // Público: troca o refresh token por um novo par.
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Body() dto: RefreshRequestDto): Promise<TokensResponseDto> {
    const tokens = await this.refreshTokenUseCase.execute({ refreshToken: dto.refreshToken });
    return TokensResponseDto.fromTokens(tokens);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: AuthTokenPayload): Promise<UserResponseDto> {
    const dto = await this.getMeUseCase.execute({ userId: user.sub });
    return UserResponseDto.fromDto(dto);
  }

  // Público: sempre responde 204, mesmo se o e-mail não existir (anti-enumeração).
  @Post('request-password-reset')
  @HttpCode(204)
  async requestPasswordReset(@Body() dto: RequestPasswordResetDto): Promise<void> {
    await this.requestPasswordResetUseCase.execute({ email: dto.email });
  }

  // Público: consome o token de reset.
  @Post('reset-password')
  @HttpCode(204)
  async resetPassword(@Body() dto: ResetPasswordRequestDto): Promise<void> {
    await this.resetPasswordUseCase.execute(new ResetPasswordCommand(dto.token, dto.newPassword));
  }
}
