import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { FinanceUseCases } from '../../../../contexts/finance/application/use-cases/finance.use-cases';
import {
  BalancesDto,
  BankAccountDto,
  CashEntryDto,
  DreDto,
  FinancialCategoryDto,
} from '../../../../contexts/finance/application/dto/finance.dto';
import { AuthTokenPayload } from '../../../../contexts/auth/application/ports/output/token-service.port';
import { AdminGuard } from '../../../security/guards/admin.guard';
import { CurrentUser } from '../../../security/decorators/current-user.decorator';
import {
  BalancesQueryDto,
  CancelCashEntryRequestDto,
  CreateBankAccountRequestDto,
  CreateCashEntryRequestDto,
  CreateCategoryRequestDto,
  CreateTransferRequestDto,
  PeriodQueryDto,
  UpdateBankAccountRequestDto,
  UpdateCategoryRequestDto,
} from './dto/finance-request.dto';

/**
 * Contas bancárias.
 *
 * `AdminGuard` no controller inteiro — como em todo o financeiro. A §5 é explícita: o Modelista não
 * vê **nenhum** valor em dinheiro, e "cadastrar conta bancária e categoria" é ❌ para ele. Não há
 * uma única rota deste arquivo alcançável pelo papel `modelista`.
 */
@Controller('finance/bank-accounts')
@UseGuards(AdminGuard)
export class BankAccountController {
  constructor(private readonly finance: FinanceUseCases) {}

  @Get()
  async list(@CurrentUser() user: AuthTokenPayload): Promise<BankAccountDto[]> {
    return this.finance.listBankAccounts(user.accountId);
  }

  @Post()
  @HttpCode(201)
  async create(
    @CurrentUser() user: AuthTokenPayload,
    @Body() dto: CreateBankAccountRequestDto,
  ): Promise<BankAccountDto> {
    return this.finance.createBankAccount(user.accountId, dto);
  }

  @Put(':id')
  async update(
    @CurrentUser() user: AuthTokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdateBankAccountRequestDto,
  ): Promise<BankAccountDto> {
    return this.finance.updateBankAccount(user.accountId, id, dto);
  }
}

/** Categorias de lançamento (§4.14). Mesma regra de acesso das contas. */
@Controller('finance/categories')
@UseGuards(AdminGuard)
export class FinancialCategoryController {
  constructor(private readonly finance: FinanceUseCases) {}

  @Get()
  async list(@CurrentUser() user: AuthTokenPayload): Promise<FinancialCategoryDto[]> {
    return this.finance.listCategories(user.accountId);
  }

  @Post()
  @HttpCode(201)
  async create(
    @CurrentUser() user: AuthTokenPayload,
    @Body() dto: CreateCategoryRequestDto,
  ): Promise<FinancialCategoryDto> {
    return this.finance.createCategory(user.accountId, dto);
  }

  @Put(':id')
  async update(
    @CurrentUser() user: AuthTokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryRequestDto,
  ): Promise<FinancialCategoryDto> {
    return this.finance.updateCategory(user.accountId, id, dto);
  }

  /** Cria as sementes da §4.14 que faltarem. Idempotente — pode rodar quantas vezes quiser. */
  @Post('defaults')
  @HttpCode(200)
  async seedDefaults(@CurrentUser() user: AuthTokenPayload): Promise<FinancialCategoryDto[]> {
    return this.finance.seedDefaultCategories(user.accountId);
  }
}

/**
 * Lançamentos de caixa.
 *
 * **Não existe rota de edição** — e a ausência é a regra (§4.15): valor de lançamento efetivado não
 * se corrige, cancela-se com motivo e lança-se de novo. Um `PUT /finance/entries/:id` apagaria o
 * rastro de que o número já foi outro.
 */
@Controller('finance/entries')
@UseGuards(AdminGuard)
export class CashEntryController {
  constructor(private readonly finance: FinanceUseCases) {}

  @Get()
  async list(
    @CurrentUser() user: AuthTokenPayload,
    @Query() query: PeriodQueryDto,
  ): Promise<CashEntryDto[]> {
    return this.finance.listEntries(user.accountId, query.from, query.to, query.bankAccountId);
  }

  @Post()
  @HttpCode(201)
  async create(
    @CurrentUser() user: AuthTokenPayload,
    @Body() dto: CreateCashEntryRequestDto,
  ): Promise<CashEntryDto> {
    return this.finance.recordEntry(user.accountId, user.sub, dto);
  }

  /** Transferência entre contas próprias: move saldo, fica fora do DRE (§4.16). */
  @Post('transfers')
  @HttpCode(201)
  async transfer(
    @CurrentUser() user: AuthTokenPayload,
    @Body() dto: CreateTransferRequestDto,
  ): Promise<CashEntryDto> {
    return this.finance.recordTransfer(user.accountId, user.sub, dto);
  }

  @Patch(':id/cancel')
  async cancel(
    @CurrentUser() user: AuthTokenPayload,
    @Param('id') id: string,
    @Body() dto: CancelCashEntryRequestDto,
  ): Promise<CashEntryDto> {
    return this.finance.cancelEntry(user.accountId, id, dto.reason, user.sub);
  }
}

/** DRE de caixa e saldos — consulta agregada, nunca tabela (§4.16). */
@Controller('finance')
@UseGuards(AdminGuard)
export class FinanceReportController {
  constructor(private readonly finance: FinanceUseCases) {}

  @Get('dre')
  async dre(
    @CurrentUser() user: AuthTokenPayload,
    @Query() query: PeriodQueryDto,
  ): Promise<DreDto> {
    return this.finance.dre(user.accountId, query.from, query.to);
  }

  @Get('balances')
  async balances(
    @CurrentUser() user: AuthTokenPayload,
    @Query() query: BalancesQueryDto,
  ): Promise<BalancesDto> {
    return this.finance.balances(user.accountId, query.until);
  }
}
