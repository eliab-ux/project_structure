import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpException,
  HttpStatus,
  Get,
  UseGuards,
} from '@nestjs/common';
import { CreateUserUseCase } from '../../../../contexts/user/application/use-cases/create-user/create-user.use-case';
import { UserAlreadyExistsException } from '../../../../contexts/user/domain/exceptions/user-already-exists.exception';
import { RegisterResellerUseCase } from '../../../../contexts/reseller/application/use-cases/register-reseller/register-reseller.use-case';
import { LoginUserUseCase } from '../../../../contexts/auth/application/use-cases/login/login-user.use-case';
import { RefreshTokenUseCase } from '../../../../contexts/auth/application/use-cases/login/refresh-token.use-case';
import { RequestPasswordResetUseCase } from '../../../../contexts/auth/application/use-cases/request-password-reset/request-password-reset.use-case';
import { ResetPasswordUseCase } from '../../../../contexts/auth/application/use-cases/reset-password/reset-password.use-case';
import {
  SyncUsersToSupabaseUseCase,
  SyncResult,
} from '../../../../contexts/auth/application/use-cases/sync-users-to-supabase/sync-users-to-supabase.use-case';
import { CreateUserCommand } from '../../../../contexts/user/application/use-cases/create-user/create-user.command';
import { RegisterResellerCommand } from '../../../../contexts/reseller/application/use-cases/register-reseller/register-reseller.use-case';
import { LoginUserCommand } from '../../../../contexts/auth/application/use-cases/login/login.command';
import { RefreshTokenCommand } from '../../../../contexts/auth/application/use-cases/login/refresh-token.command';
import { RequestPasswordResetCommand } from '../../../../contexts/auth/application/use-cases/request-password-reset/request-password-reset.command';
import { ResetPasswordCommand } from '../../../../contexts/auth/application/use-cases/reset-password/reset-password.command';
import { RegisterResellerRequestDto } from './dto/register-reseller.request.dto';
import { LoginRequestDto } from './dto/login.request.dto';
import { RefreshTokenRequestDto } from './dto/refresh-token.request.dto';
import { AuthResponseDto } from './dto/auth.response.dto';
import { ResellerDto } from '../../../../contexts/reseller/application/dto/reseller.dto';
import { ForgotPasswordRequestDto } from './dto/forgot-password.request.dto';
import { ResetPasswordRequestDto } from './dto/reset-password.request.dto';
import { JwtAuthGuard } from '@infrastructure/security/guards/jwt-auth.guard';
import { CurrentUser } from '@infrastructure/security/decorators/current-user.decorator';
import { AuthTokenPayload } from '@infrastructure/security/ports/token-service.port';
import { GetMeUseCase } from '@contexts/auth/application/use-cases/me/get-me.use-case';
import { GetMeCommand } from '@contexts/auth/application/use-cases/me/get-me.command';
import { AuthMeResponseDto } from './dto/auth-me.response.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly createUserUseCase: CreateUserUseCase,
    private readonly registerResellerUseCase: RegisterResellerUseCase,
    private readonly loginUserUseCase: LoginUserUseCase,
    private readonly refreshTokenUseCase: RefreshTokenUseCase,
    private readonly requestPasswordResetUseCase: RequestPasswordResetUseCase,
    private readonly resetPasswordUseCase: ResetPasswordUseCase,
    private readonly syncUsersToSupabaseUseCase: SyncUsersToSupabaseUseCase,
    private readonly getMeUseCase: GetMeUseCase,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterResellerRequestDto): Promise<ResellerDto> {
    try {
      const userDto = await this.createUserUseCase.execute(
        new CreateUserCommand(dto.email, dto.name, dto.password),
      );

      const command = new RegisterResellerCommand(
        userDto.id,
        dto.cpf,
        dto.name,
        dto.type,
        dto.birthDate,
        dto.zipCode,
        dto.street,
        dto.number,
        dto.complement ?? null,
        dto.neighborhood,
        dto.city,
        dto.state,
        dto.phone ?? null,
        dto.bankName ?? null,
        dto.bankCode ?? null,
        dto.bankAgency ?? null,
        dto.bankAccount ?? null,
        dto.bankAccountType ?? null,
        dto.bankHolderName ?? null,
        dto.bankHolderCpf ?? null,
        dto.pixKey ?? null,
        dto.pixKeyType ?? null,
      );

      return this.registerResellerUseCase.execute(command);
    } catch (error) {
      if (error instanceof UserAlreadyExistsException) {
        throw new HttpException(
          'Esse email já está cadastrado. Clique em "Esqueci minha senha" para receber um link seguro.',
          HttpStatus.CONFLICT,
        );
      }

      throw error;
    }
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginRequestDto): Promise<AuthResponseDto> {
    const result = await this.loginUserUseCase.execute(
      new LoginUserCommand(dto.email, dto.password),
    );
    return AuthResponseDto.from(result);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenRequestDto): Promise<AuthResponseDto> {
    const result = await this.refreshTokenUseCase.execute(
      new RefreshTokenCommand(dto.refreshToken),
    );
    return AuthResponseDto.from(result);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(): Promise<void> {
    // Stateless logout; the client should discard the tokens
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordRequestDto): Promise<{ message: string }> {
    await this.requestPasswordResetUseCase.execute(new RequestPasswordResetCommand(dto.email));

    return {
      message:
        'Se um cadastro existir neste email, enviaremos em instantes um link seguro para você redefinir a senha.',
    };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordRequestDto): Promise<{ message: string }> {
    await this.resetPasswordUseCase.execute(
      new ResetPasswordCommand(dto.accessToken, dto.newPassword),
    );

    return { message: 'Senha alterada com sucesso.' };
  }

  @Post('sync-users-to-supabase')
  @HttpCode(HttpStatus.OK)
  async syncUsersToSupabase(): Promise<SyncResult> {
    return this.syncUsersToSupabaseUseCase.execute();
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async me(@CurrentUser() user: AuthTokenPayload): Promise<AuthMeResponseDto> {
    const result = await this.getMeUseCase.execute(new GetMeCommand(user));
    return AuthMeResponseDto.from(result);
  }
}
