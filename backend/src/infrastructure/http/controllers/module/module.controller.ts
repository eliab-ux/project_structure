import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { IsBoolean } from 'class-validator';
import {
  ListModulesQuery,
  ListModulesUseCase,
} from '../../../../contexts/module/application/use-cases/list-modules/list-modules.use-case';
import {
  ToggleModuleCommand,
  ToggleModuleUseCase,
} from '../../../../contexts/module/application/use-cases/toggle-module/toggle-module.use-case';
import { ModuleDto } from '../../../../contexts/module/application/dto/module.dto';
import { AuthTokenPayload } from '../../../../contexts/auth/application/ports/output/token-service.port';
import { PERMISSIONS } from '../../../../contexts/role/domain/permissions.catalog';
import { PermissionGuard } from '../../../security/guards/permission.guard';
import { RequirePermission } from '../../../security/decorators/require-permission.decorator';
import { CurrentUser } from '../../../security/decorators/current-user.decorator';

export class ToggleModuleRequestDto {
  @IsBoolean()
  active!: boolean;
}

export class ToggleModuleResponseDto {
  moduleCode!: string;
  active!: boolean;
  /** O frontend renova a sessão quando isto vem `true` — ver ToggleModuleUseCase. */
  requiresTokenRefresh!: boolean;
}

/**
 * A tela de módulos da conta.
 *
 * **Sem `@RequireModule` aqui, de propósito**: este controller administra os módulos, então exigir
 * um módulo ativo para acessá-lo criaria a situação em que desligar o módulo errado tranca a conta
 * fora da própria tela de módulos. Ele pertence ao CORE, que não é desativável.
 *
 * O `id` da rota é o CÓDIGO do módulo (`VND`, `ROT`), não um uuid — por isso não há `ParseUUIDPipe`;
 * o use case valida contra o catálogo, que é a checagem que realmente importa.
 */
@Controller('modules')
@UseGuards(PermissionGuard)
export class ModuleController {
  constructor(
    private readonly listModulesUseCase: ListModulesUseCase,
    private readonly toggleModuleUseCase: ToggleModuleUseCase,
  ) {}

  /**
   * Requer apenas `account.read`: ver quais módulos existem e quais estão ligados é informação de
   * configuração da conta, não uma operação privilegiada. Ligar/desligar é que exige `account.update`.
   */
  @Get()
  @RequirePermission(PERMISSIONS.account.read)
  async list(@CurrentUser() user: AuthTokenPayload): Promise<ModuleDto[]> {
    return this.listModulesUseCase.execute(new ListModulesQuery(user.accountId));
  }

  @Patch(':code')
  @RequirePermission(PERMISSIONS.account.update)
  async toggle(
    @Param('code') code: string,
    @Body() dto: ToggleModuleRequestDto,
    @CurrentUser() user: AuthTokenPayload,
  ): Promise<ToggleModuleResponseDto> {
    return this.toggleModuleUseCase.execute(
      new ToggleModuleCommand(user.accountId, code.trim().toUpperCase(), dto.active),
    );
  }
}
