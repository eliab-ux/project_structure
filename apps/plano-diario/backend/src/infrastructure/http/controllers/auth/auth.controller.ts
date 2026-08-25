import { Body, Controller, Get, HttpCode, Logger, Patch, Post, UseGuards } from '@nestjs/common';
import { LoginCommand } from '../../../../contexts/auth/application/use-cases/login/login.command';
import { LoginUseCase } from '../../../../contexts/auth/application/use-cases/login/login.use-case';
import { RefreshTokenUseCase } from '../../../../contexts/auth/application/use-cases/refresh/refresh-token.use-case';
import { RequestPasswordResetUseCase } from '../../../../contexts/auth/application/use-cases/request-password-reset/request-password-reset.use-case';
import { ResetPasswordUseCase } from '../../../../contexts/auth/application/use-cases/reset-password/reset-password.use-case';
import { GetMeUseCase } from '../../../../contexts/user/application/use-cases/get-me/get-me.use-case';
import { RegisterUserCommand } from '../../../../contexts/user/application/use-cases/register-user/register-user.command';
import { RegisterUserUseCase } from '../../../../contexts/user/application/use-cases/register-user/register-user.use-case';
import { UpdatePhoneUseCase } from '../../../../contexts/user/application/use-cases/update-phone/update-phone.use-case';
import { CurrentUser } from '../../../security/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../security/guards/jwt-auth.guard';
import { AuthTokenPayload } from '../../../security/ports/token-service.port';
import {
  ForgotPasswordRequestDto,
  LoginRequestDto,
  RefreshRequestDto,
  RegisterRequestDto,
  ResetPasswordRequestDto,
  UpdatePhoneRequestDto,
} from './dto/auth-request.dto';
import { LoginResponseDto, TokensResponseDto, UserResponseDto } from './dto/auth-response.dto';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly registerUserUseCase: RegisterUserUseCase,
    private readonly loginUseCase: LoginUseCase,
    private readonly refreshTokenUseCase: RefreshTokenUseCase,
    private readonly getMeUseCase: GetMeUseCase,
    private readonly updatePhoneUseCase: UpdatePhoneUseCase,
    private readonly requestPasswordResetUseCase: RequestPasswordResetUseCase,
    private readonly resetPasswordUseCase: ResetPasswordUseCase,
  ) {}

  // Endpoint PÚBLICO — sem guard por definição: é a criação da própria conta.
  // Não há dado de terceiro exposto; o e-mail duplicado responde 400 com mensagem de negócio.
  @Post('register')
  @HttpCode(201)
  async register(@Body() dto: RegisterRequestDto): Promise<UserResponseDto> {
    const user = await this.registerUserUseCase.execute(
      new RegisterUserCommand(dto.name, dto.email, dto.password, dto.phone),
    );
    this.logger.log('Conta criada', { userId: user.id });
    return UserResponseDto.fromDto(user);
  }

  // Endpoint PÚBLICO — sem guard por definição: é onde o token é emitido.
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginRequestDto): Promise<LoginResponseDto> {
    // Sem log do e-mail ou da senha na tentativa; só o resultado, já com o id resolvido.
    const session = await this.loginUseCase.execute(new LoginCommand(dto.email, dto.password));
    this.logger.log('Usuário autenticado', { userId: session.user.id });
    return LoginResponseDto.fromSession(session);
  }

  // Endpoint PÚBLICO — sem guard por definição: o access token pode já estar expirado aqui.
  // A autorização vem da validação do refresh token dentro do use case.
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Body() dto: RefreshRequestDto): Promise<TokensResponseDto> {
    const tokens = await this.refreshTokenUseCase.execute({ refreshToken: dto.refreshToken });
    return TokensResponseDto.fromTokens(tokens);
  }

  // Endpoint PÚBLICO — sem guard por definição: quem esqueceu a senha não tem como autenticar.
  //
  // Responde SEMPRE 200 com a mesma mensagem, exista a conta ou não. Um 404 aqui viraria um
  // verificador de e-mails cadastrados.
  @Post('forgot-password')
  @HttpCode(200)
  async forgotPassword(@Body() dto: ForgotPasswordRequestDto): Promise<{ message: string }> {
    await this.requestPasswordResetUseCase.execute({ email: dto.email });
    return {
      message:
        'Se houver uma conta com esse e-mail e um WhatsApp cadastrado, o código chegará em instantes.',
    };
  }

  // Endpoint PÚBLICO — sem guard por definição: a autorização é o código de 6 dígitos que só o
  // dono do WhatsApp recebeu. O use case conta cada palpite errado e mata o código após 5.
  @Post('reset-password')
  @HttpCode(200)
  async resetPassword(@Body() dto: ResetPasswordRequestDto): Promise<{ message: string }> {
    await this.resetPasswordUseCase.execute({
      email: dto.email,
      code: dto.code,
      newPassword: dto.newPassword,
    });
    return { message: 'Senha alterada. Você já pode entrar com a senha nova.' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() payload: AuthTokenPayload): Promise<UserResponseDto> {
    const user = await this.getMeUseCase.execute({ userId: payload.sub });
    return UserResponseDto.fromDto(user);
  }

  /** O `userId` vem do token — nunca do corpo, senão daria para editar o número de outra conta. */
  @Patch('me/phone')
  @UseGuards(JwtAuthGuard)
  async updatePhone(
    @CurrentUser() payload: AuthTokenPayload,
    @Body() dto: UpdatePhoneRequestDto,
  ): Promise<UserResponseDto> {
    const user = await this.updatePhoneUseCase.execute({ userId: payload.sub, phone: dto.phone });
    this.logger.log('WhatsApp de contato atualizado', { userId: payload.sub });
    return UserResponseDto.fromDto(user);
  }
}
