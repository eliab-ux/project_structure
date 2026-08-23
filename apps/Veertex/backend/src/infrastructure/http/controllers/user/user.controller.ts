import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  CreateUserCommand,
  CreateUserUseCase,
} from '../../../../contexts/user/application/use-cases/create-user/create-user.use-case';
import { ListUsersUseCase } from '../../../../contexts/user/application/use-cases/list-users/list-users.use-case';
import {
  UpdateUserCommand,
  UpdateUserUseCase,
} from '../../../../contexts/user/application/use-cases/update-user/update-user.use-case';
import {
  SetUserStatusCommand,
  SetUserStatusUseCase,
} from '../../../../contexts/user/application/use-cases/set-user-status/set-user-status.use-case';
import { AuthTokenPayload } from '../../../../contexts/auth/application/ports/output/token-service.port';
import { CommissionModel } from '../../../../contexts/user/domain/commission-model';
import { PERMISSIONS } from '../../../../contexts/role/domain/permissions.catalog';
import { PermissionGuard } from '../../../security/guards/permission.guard';
import { RequirePermission } from '../../../security/decorators/require-permission.decorator';
import { CurrentUser } from '../../../security/decorators/current-user.decorator';
import { UserResponseDto } from '../auth/dto/auth-response.dto';
import {
  CreateUserRequestDto,
  SetUserStatusRequestDto,
  UpdateUserRequestDto,
} from './dto/user-request.dto';

@Controller('users')
@UseGuards(PermissionGuard)
export class UserController {
  constructor(
    private readonly createUserUseCase: CreateUserUseCase,
    private readonly listUsersUseCase: ListUsersUseCase,
    private readonly updateUserUseCase: UpdateUserUseCase,
    private readonly setUserStatusUseCase: SetUserStatusUseCase,
  ) {}

  @Get()
  @RequirePermission(PERMISSIONS.users.read)
  async list(): Promise<UserResponseDto[]> {
    const users = await this.listUsersUseCase.execute();
    return users.map((user) => UserResponseDto.from(user));
  }

  @Post()
  @RequirePermission(PERMISSIONS.users.create)
  async create(
    @Body() dto: CreateUserRequestDto,
    @CurrentUser() actor: AuthTokenPayload,
  ): Promise<UserResponseDto> {
    const user = await this.createUserUseCase.execute(
      new CreateUserCommand(
        actor.accountId,
        dto.name,
        dto.email,
        dto.phone,
        dto.password,
        dto.roleId,
        dto.commissionModel as CommissionModel | undefined,
      ),
    );
    return UserResponseDto.from(user);
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.users.update)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserRequestDto,
  ): Promise<UserResponseDto> {
    const user = await this.updateUserUseCase.execute(
      new UpdateUserCommand(
        id,
        dto.name,
        dto.email,
        dto.phone,
        dto.roleId,
        dto.commissionModel as CommissionModel | undefined,
      ),
    );
    return UserResponseDto.from(user);
  }

  /**
   * PATCH and not DELETE: a user is disabled, never removed — their name is on orders, stock
   * movements and audit rows.
   */
  @Patch(':id/status')
  @RequirePermission(PERMISSIONS.users.disable)
  async setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetUserStatusRequestDto,
    @CurrentUser() actor: AuthTokenPayload,
  ): Promise<UserResponseDto> {
    const user = await this.setUserStatusUseCase.execute(
      // The acting user comes from the token, so "you cannot disable yourself" cannot be bypassed
      // by sending someone else's id.
      new SetUserStatusCommand(id, dto.active, actor.sub),
    );
    return UserResponseDto.from(user);
  }
}
