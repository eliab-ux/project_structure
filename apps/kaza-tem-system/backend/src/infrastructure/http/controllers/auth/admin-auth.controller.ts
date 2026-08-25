import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { LoginAdminUseCase } from '../../../../contexts/auth/application/use-cases/login-admin/login-admin.use-case';
import { LoginAdminCommand } from '../../../../contexts/auth/application/use-cases/login-admin/login-admin.command';
import { AdminLoginRequestDto } from './dto/admin-login.request.dto';
import { AdminAuthResponseDto } from './dto/admin-auth.response.dto';
import { UserResponseDto } from '../user/dto/user.response.dto';

@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly loginAdminUseCase: LoginAdminUseCase) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: AdminLoginRequestDto): Promise<AdminAuthResponseDto> {
    const result = await this.loginAdminUseCase.execute(
      new LoginAdminCommand(dto.email, dto.password),
    );
    return AdminAuthResponseDto.from(result.tokens, UserResponseDto.fromDto(result.user));
  }
}
