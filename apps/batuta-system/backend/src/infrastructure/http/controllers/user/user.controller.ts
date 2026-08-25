import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CreateUserUseCase } from '../../../../contexts/user/application/use-cases/create-user/create-user.use-case';
import { CreateUserCommand } from '../../../../contexts/user/application/use-cases/create-user/create-user.command';
import { ListUsersUseCase } from '../../../../contexts/user/application/use-cases/list-users/list-users.use-case';
import { ListUsersQuery } from '../../../../contexts/user/application/use-cases/list-users/list-users.query';
import { ChangeUserRoleUseCase } from '../../../../contexts/user/application/use-cases/change-user-role/change-user-role.use-case';
import { ChangeUserRoleCommand } from '../../../../contexts/user/application/use-cases/change-user-role/change-user-role.command';
import { ChangeUserPhoneUseCase } from '../../../../contexts/user/application/use-cases/change-user-phone/change-user-phone.use-case';
import { ChangeUserPhoneCommand } from '../../../../contexts/user/application/use-cases/change-user-phone/change-user-phone.command';
import { DisableUserUseCase } from '../../../../contexts/user/application/use-cases/disable-user/disable-user.use-case';
import { DisableUserCommand } from '../../../../contexts/user/application/use-cases/disable-user/disable-user.command';
import { AuthTokenPayload } from '../../../../contexts/auth/application/ports/output/token-service.port';
import { AccountAdminGuard } from '../../../security/guards/account-admin.guard';
import { JwtAuthGuard } from '../../../security/guards/jwt-auth.guard';
import { ClientIp, CurrentUser } from '../../../security/decorators/current-user.decorator';
import { UserResponseDto } from '../auth/dto/auth-response.dto';
import {
  ChangeUserPhoneRequestDto,
  ChangeUserRoleRequestDto,
  CreateUserRequestDto,
} from './dto/user-request.dto';

/**
 * Users of the current account.
 *
 * Guard placement is deliberate: reading the team is fine for any authenticated user of the
 * account, but creating, promoting and disabling are ACCOUNT_ADMIN only — the guard sits on the
 * method, the most restrictive level (Least Privilege).
 */
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(
    private readonly createUser: CreateUserUseCase,
    private readonly listUsers: ListUsersUseCase,
    private readonly changeUserRole: ChangeUserRoleUseCase,
    private readonly changeUserPhone: ChangeUserPhoneUseCase,
    private readonly disableUser: DisableUserUseCase,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthTokenPayload): Promise<UserResponseDto[]> {
    const users = await this.listUsers.execute(new ListUsersQuery(user.accountId));
    return users.map((dto) => UserResponseDto.from(dto));
  }

  @Post()
  @HttpCode(201)
  @UseGuards(AccountAdminGuard)
  async create(
    @Body() dto: CreateUserRequestDto,
    @CurrentUser() user: AuthTokenPayload,
    @ClientIp() ip: string | null,
  ): Promise<UserResponseDto> {
    const created = await this.createUser.execute(
      new CreateUserCommand(
        user.accountId,
        user.sub,
        dto.name,
        dto.email,
        dto.phone,
        dto.password,
        dto.role,
        ip,
      ),
    );
    return UserResponseDto.from(created);
  }

  /**
   * ACCOUNT_ADMIN only — and it is the most sensitive write on this controller. The recovery code
   * goes to this number, so being able to change it is being able to take over the account; that is
   * why it is not a self-service edit and why it lands in the audit trail.
   */
  @Patch(':id/phone')
  @UseGuards(AccountAdminGuard)
  async changePhone(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeUserPhoneRequestDto,
    @CurrentUser() user: AuthTokenPayload,
    @ClientIp() ip: string | null,
  ): Promise<UserResponseDto> {
    const updated = await this.changeUserPhone.execute(
      new ChangeUserPhoneCommand(user.accountId, user.sub, id, dto.phone, ip),
    );
    return UserResponseDto.from(updated);
  }

  @Patch(':id/role')
  @UseGuards(AccountAdminGuard)
  async changeRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeUserRoleRequestDto,
    @CurrentUser() user: AuthTokenPayload,
    @ClientIp() ip: string | null,
  ): Promise<UserResponseDto> {
    const updated = await this.changeUserRole.execute(
      new ChangeUserRoleCommand(user.accountId, user.sub, id, dto.role, ip),
    );
    return UserResponseDto.from(updated);
  }

  @Patch(':id/disable')
  @UseGuards(AccountAdminGuard)
  async disable(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthTokenPayload,
    @ClientIp() ip: string | null,
  ): Promise<UserResponseDto> {
    const updated = await this.disableUser.execute(
      new DisableUserCommand(user.accountId, user.sub, id, ip),
    );
    return UserResponseDto.from(updated);
  }
}
