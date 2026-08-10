import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ListRolesUseCase } from '../../../../contexts/role/application/use-cases/list-roles/list-roles.use-case';
import {
  CreateRoleCommand,
  CreateRoleUseCase,
} from '../../../../contexts/role/application/use-cases/create-role/create-role.use-case';
import {
  UpdateRoleCommand,
  UpdateRoleUseCase,
} from '../../../../contexts/role/application/use-cases/update-role/update-role.use-case';
import {
  DeleteRoleCommand,
  DeleteRoleUseCase,
} from '../../../../contexts/role/application/use-cases/delete-role/delete-role.use-case';
import { AuthTokenPayload } from '../../../../contexts/auth/application/ports/output/token-service.port';
import {
  ALL_PERMISSIONS,
  PERMISSIONS,
  PERMISSION_AREAS,
} from '../../../../contexts/role/domain/permissions.catalog';
import { PermissionGuard } from '../../../security/guards/permission.guard';
import { RequirePermission } from '../../../security/decorators/require-permission.decorator';
import { CurrentUser } from '../../../security/decorators/current-user.decorator';
import { RoleResponseDto } from '../auth/dto/auth-response.dto';
import { CreateRoleRequestDto, UpdateRoleRequestDto } from './dto/role-request.dto';

@Controller('roles')
@UseGuards(PermissionGuard)
export class RoleController {
  constructor(
    private readonly listRolesUseCase: ListRolesUseCase,
    private readonly createRoleUseCase: CreateRoleUseCase,
    private readonly updateRoleUseCase: UpdateRoleUseCase,
    private readonly deleteRoleUseCase: DeleteRoleUseCase,
  ) {}

  @Get()
  @RequirePermission(PERMISSIONS.roles.read)
  async list(): Promise<RoleResponseDto[]> {
    const roles = await this.listRolesUseCase.execute();
    return roles.map((role) => RoleResponseDto.from(role));
  }

  /**
   * The permission catalogue, so the UI can render the tree instead of hardcoding a copy of it.
   *
   * Read-only and identical for every account — it is the list of permissions this BUILD knows
   * about, not anything the account owns.
   */
  @Get('catalog')
  @RequirePermission(PERMISSIONS.roles.read)
  catalog(): { areas: string[]; permissions: string[] } {
    return { areas: PERMISSION_AREAS, permissions: ALL_PERMISSIONS };
  }

  @Post()
  @RequirePermission(PERMISSIONS.roles.create)
  async create(
    @Body() dto: CreateRoleRequestDto,
    @CurrentUser() actor: AuthTokenPayload,
  ): Promise<RoleResponseDto> {
    const role = await this.createRoleUseCase.execute(
      new CreateRoleCommand(actor.accountId, dto.code, dto.name, dto.permissions, dto.description),
    );
    return RoleResponseDto.from(role);
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.roles.update)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleRequestDto,
  ): Promise<RoleResponseDto> {
    const role = await this.updateRoleUseCase.execute(
      new UpdateRoleCommand(id, dto.name, dto.description, dto.permissions),
    );
    return RoleResponseDto.from(role);
  }

  /** 204 with no body (CLAUDE.md). The deletion is soft — the row stays for audit. */
  @Delete(':id')
  @HttpCode(204)
  @RequirePermission(PERMISSIONS.roles.delete)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.deleteRoleUseCase.execute(new DeleteRoleCommand(id));
  }
}
