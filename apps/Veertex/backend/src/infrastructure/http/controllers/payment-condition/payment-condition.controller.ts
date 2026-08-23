import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  CreatePaymentConditionCommand,
  CreatePaymentConditionUseCase,
} from '../../../../contexts/payment-condition/application/use-cases/create-payment-condition/create-payment-condition.use-case';
import {
  ListPaymentConditionsQuery,
  ListPaymentConditionsUseCase,
} from '../../../../contexts/payment-condition/application/use-cases/list-payment-conditions/list-payment-conditions.use-case';
import {
  UpdatePaymentConditionCommand,
  UpdatePaymentConditionUseCase,
} from '../../../../contexts/payment-condition/application/use-cases/update-payment-condition/update-payment-condition.use-case';
import { PaymentConditionDto } from '../../../../contexts/payment-condition/application/dto/payment-condition.dto';
import { PaymentConditionKind } from '../../../../contexts/payment-condition/domain/payment-condition-kind';
import { AuthTokenPayload } from '../../../../contexts/auth/application/ports/output/token-service.port';
import { MODULES } from '../../../../contexts/module/domain/modules.catalog';
import { PERMISSIONS } from '../../../../contexts/role/domain/permissions.catalog';
import { ModuleGuard } from '../../../security/guards/module.guard';
import { PermissionGuard } from '../../../security/guards/permission.guard';
import { RequireModule } from '../../../security/decorators/require-module.decorator';
import { RequirePermission } from '../../../security/decorators/require-permission.decorator';
import { CurrentUser } from '../../../security/decorators/current-user.decorator';
import {
  CreatePaymentConditionRequestDto,
  ListPaymentConditionsQueryDto,
  UpdatePaymentConditionRequestDto,
} from './dto/payment-condition-request.dto';

/**
 * Condições de pagamento nomeadas — configuração comercial do VND (§4.2 do 02A).
 *
 * `@RequireModule(VND)` no controller; a permissão é a de **configuração comercial**
 * (`sales.settings.*`), NÃO `orders.*` — operar pedido ≠ configurar comércio (decisão do Eliab).
 * `read` para listar (o seletor do pedido lê daqui); `manage` para criar/editar/desativar.
 */
@Controller('payment-conditions')
@UseGuards(ModuleGuard, PermissionGuard)
@RequireModule(MODULES.VND)
export class PaymentConditionController {
  constructor(
    private readonly createUseCase: CreatePaymentConditionUseCase,
    private readonly listUseCase: ListPaymentConditionsUseCase,
    private readonly updateUseCase: UpdatePaymentConditionUseCase,
  ) {}

  @Get()
  @RequirePermission(PERMISSIONS.sales.settingsRead)
  async list(@Query() query: ListPaymentConditionsQueryDto): Promise<PaymentConditionDto[]> {
    return this.listUseCase.execute(new ListPaymentConditionsQuery(query.includeInactive ?? false));
  }

  @Post()
  @RequirePermission(PERMISSIONS.sales.settingsManage)
  async create(
    @Body() dto: CreatePaymentConditionRequestDto,
    @CurrentUser() actor: AuthTokenPayload,
  ): Promise<PaymentConditionDto> {
    return this.createUseCase.execute(
      new CreatePaymentConditionCommand(
        actor.accountId,
        dto.name,
        dto.kind as PaymentConditionKind,
      ),
    );
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.sales.settingsManage)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePaymentConditionRequestDto,
  ): Promise<PaymentConditionDto> {
    return this.updateUseCase.execute(
      new UpdatePaymentConditionCommand(id, {
        name: dto.name,
        kind: dto.kind as PaymentConditionKind | undefined,
        active: dto.active,
      }),
    );
  }
}
