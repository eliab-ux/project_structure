import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import {
  GetFieldConfigQuery,
  GetFieldConfigUseCase,
} from '../../../../contexts/field-config/application/use-cases/get-field-config/get-field-config.use-case';
import {
  SetFieldConfigCommand,
  SetFieldConfigUseCase,
} from '../../../../contexts/field-config/application/use-cases/set-field-config/set-field-config.use-case';
import { EntityFieldConfigDto } from '../../../../contexts/field-config/application/dto/field-config.dto';
import { CONFIGURABLE_ENTITIES } from '../../../../contexts/field-config/domain/field-catalog.registry';
import { AuthTokenPayload } from '../../../../contexts/auth/application/ports/output/token-service.port';
import { PERMISSIONS } from '../../../../contexts/role/domain/permissions.catalog';
import { PermissionGuard } from '../../../security/guards/permission.guard';
import { RequirePermission } from '../../../security/decorators/require-permission.decorator';
import { CurrentUser } from '../../../security/decorators/current-user.decorator';
import { SetFieldConfigRequestDto } from './dto/field-config-request.dto';

/**
 * Personalizar Campos — §3.6 do CORE. É onde a conta governa `visible`/`required`/`label`/`order`
 * dos campos que já existem; nunca cria campo (isso é do catálogo, fixo em código).
 *
 * **Sem `@RequireModule`**: personalizar campos é CORE, como Contato e Produto. Vale para toda conta.
 */
@Controller('field-config')
@UseGuards(PermissionGuard)
export class FieldConfigController {
  constructor(
    private readonly getFieldConfigUseCase: GetFieldConfigUseCase,
    private readonly setFieldConfigUseCase: SetFieldConfigUseCase,
  ) {}

  /**
   * As entidades configuráveis, para a tela montar as abas sem manter uma cópia da lista.
   *
   * Antes de `:entity`, senão o roteador trataria "entities" como uma entidade e o use case
   * responderia "entidade não configurável" para uma rota que existe.
   */
  @Get('entities')
  @RequirePermission(PERMISSIONS.fields.read)
  entities(): { entities: string[] } {
    return { entities: [...CONFIGURABLE_ENTITIES] };
  }

  @Get(':entity')
  @RequirePermission(PERMISSIONS.fields.read)
  async get(@Param('entity') entity: string): Promise<EntityFieldConfigDto> {
    return this.getFieldConfigUseCase.execute(new GetFieldConfigQuery(entity));
  }

  @Put(':entity')
  @RequirePermission(PERMISSIONS.fields.update)
  async set(
    @Param('entity') entity: string,
    @Body() dto: SetFieldConfigRequestDto,
    @CurrentUser() user: AuthTokenPayload,
  ): Promise<EntityFieldConfigDto> {
    // `accountId` do TOKEN, nunca do corpo.
    return this.setFieldConfigUseCase.execute(
      new SetFieldConfigCommand(user.accountId, entity, dto.overrides),
    );
  }
}
