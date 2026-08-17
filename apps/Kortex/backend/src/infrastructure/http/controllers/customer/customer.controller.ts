import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  CreateCustomerUseCase,
  CreateCustomerCommand,
} from '../../../../contexts/customer/application/use-cases/create-customer/create-customer.use-case';
import {
  UpdateCustomerUseCase,
  UpdateCustomerCommand,
} from '../../../../contexts/customer/application/use-cases/update-customer/update-customer.use-case';
import {
  SetCustomerStatusUseCase,
  SetCustomerStatusCommand,
} from '../../../../contexts/customer/application/use-cases/set-customer-status/set-customer-status.use-case';
import { QueryCustomersUseCase } from '../../../../contexts/customer/application/use-cases/query-customers/query-customers.use-case';
import {
  CustomerDetailDto,
  CustomerForModelistaDto,
  CustomerListDto,
} from '../../../../contexts/customer/application/dto/customer.dto';
import { AuthTokenPayload } from '../../../../contexts/auth/application/ports/output/token-service.port';
import { AdminGuard } from '../../../security/guards/admin.guard';
import { ModelistaGuard } from '../../../security/guards/modelista.guard';
import { CurrentUser } from '../../../security/decorators/current-user.decorator';
import { CustomerRequestDto, SetCustomerStatusRequestDto } from './dto/customer-request.dto';

/**
 * Clientes — área do Administrativo.
 *
 * `AdminGuard` no controller inteiro: **o Modelista nunca cadastra cliente** (regra 6.2), e as
 * respostas daqui carregam CNPJ/CPF, endereço e representante, que ele também não pode ver
 * (spec §4.4). A leitura dele tem rota e DTO próprios — ver `ModelistaCustomerController`.
 */
@Controller('customers')
@UseGuards(AdminGuard)
export class CustomerController {
  constructor(
    private readonly queryCustomers: QueryCustomersUseCase,
    private readonly createCustomerUseCase: CreateCustomerUseCase,
    private readonly updateCustomerUseCase: UpdateCustomerUseCase,
    private readonly setCustomerStatusUseCase: SetCustomerStatusUseCase,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthTokenPayload): Promise<CustomerListDto[]> {
    return this.queryCustomers.list(user.accountId);
  }

  @Get(':id')
  async detail(
    @CurrentUser() user: AuthTokenPayload,
    @Param('id') id: string,
  ): Promise<CustomerDetailDto> {
    return this.queryCustomers.detail(user.accountId, id);
  }

  @Post()
  @HttpCode(201)
  async create(
    @CurrentUser() user: AuthTokenPayload,
    @Body() dto: CustomerRequestDto,
  ): Promise<CustomerDetailDto> {
    return this.createCustomerUseCase.execute(new CreateCustomerCommand(user.accountId, dto));
  }

  @Put(':id')
  async update(
    @CurrentUser() user: AuthTokenPayload,
    @Param('id') id: string,
    @Body() dto: CustomerRequestDto,
  ): Promise<CustomerDetailDto> {
    return this.updateCustomerUseCase.execute(new UpdateCustomerCommand(user.accountId, id, dto));
  }

  @Patch(':id/status')
  async setStatus(
    @CurrentUser() user: AuthTokenPayload,
    @Param('id') id: string,
    @Body() dto: SetCustomerStatusRequestDto,
  ): Promise<CustomerDetailDto> {
    return this.setCustomerStatusUseCase.execute(
      new SetCustomerStatusCommand(user.accountId, id, dto.active),
    );
  }
}

/**
 * A lista de clientes que o Modelista enxerga: nome fantasia, cidade, WhatsApp e observações.
 *
 * Rota separada, e não um parâmetro na rota do Administrativo, porque o recorte é de DTO — e um
 * `if (role === 'modelista')` dentro de um controller compartilhado é exatamente o tipo de linha
 * que alguém remove num refactor sem perceber o que ela protegia.
 */
@Controller('modelista/customers')
@UseGuards(ModelistaGuard)
export class ModelistaCustomerController {
  constructor(private readonly queryCustomers: QueryCustomersUseCase) {}

  @Get()
  async list(@CurrentUser() user: AuthTokenPayload): Promise<CustomerForModelistaDto[]> {
    return this.queryCustomers.listForModelista(user.accountId);
  }
}
