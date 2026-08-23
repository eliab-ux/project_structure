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
  CreateFinancialAccountCommand,
  CreateFinancialAccountUseCase,
} from '../../../../contexts/finance/application/use-cases/create-financial-account/create-financial-account.use-case';
import {
  ListFinancialAccountsQuery,
  ListFinancialAccountsUseCase,
} from '../../../../contexts/finance/application/use-cases/list-financial-accounts/list-financial-accounts.use-case';
import {
  UpdateFinancialAccountCommand,
  UpdateFinancialAccountUseCase,
} from '../../../../contexts/finance/application/use-cases/update-financial-account/update-financial-account.use-case';
import {
  CreateFinancialCategoryCommand,
  CreateFinancialCategoryUseCase,
} from '../../../../contexts/finance/application/use-cases/create-financial-category/create-financial-category.use-case';
import {
  ListFinancialCategoriesQuery,
  ListFinancialCategoriesUseCase,
} from '../../../../contexts/finance/application/use-cases/list-financial-categories/list-financial-categories.use-case';
import {
  UpdateFinancialCategoryCommand,
  UpdateFinancialCategoryUseCase,
} from '../../../../contexts/finance/application/use-cases/update-financial-category/update-financial-category.use-case';
import {
  CreateFinancialTitleCommand,
  CreateFinancialTitleUseCase,
} from '../../../../contexts/finance/application/use-cases/create-financial-title/create-financial-title.use-case';
import {
  SettleTitleCommand,
  SettleTitleUseCase,
} from '../../../../contexts/finance/application/use-cases/settle-title/settle-title.use-case';
import {
  ListFinancialTitlesQuery,
  ListFinancialTitlesUseCase,
} from '../../../../contexts/finance/application/use-cases/list-financial-titles/list-financial-titles.use-case';
import {
  CreateRecurringPayableCommand,
  CreateRecurringPayableUseCase,
} from '../../../../contexts/finance/application/use-cases/create-recurring-payable/create-recurring-payable.use-case';
import {
  FinancialAccountDto,
  FinancialCategoryDto,
  FinancialTitleDto,
} from '../../../../contexts/finance/application/dto/finance.dto';
import { FinancialAccountType } from '../../../../contexts/finance/domain/financial-account-type';
import { CategoryKind, CategoryOperation } from '../../../../contexts/finance/domain/category-kind';
import { SettlementMethod } from '../../../../contexts/finance/domain/entities/title-settlement.entity';
import { AuthTokenPayload } from '../../../../contexts/auth/application/ports/output/token-service.port';
import { MODULES } from '../../../../contexts/module/domain/modules.catalog';
import { PERMISSIONS } from '../../../../contexts/role/domain/permissions.catalog';
import { ModuleGuard } from '../../../security/guards/module.guard';
import { PermissionGuard } from '../../../security/guards/permission.guard';
import { RequireModule } from '../../../security/decorators/require-module.decorator';
import { RequirePermission } from '../../../security/decorators/require-permission.decorator';
import { CurrentUser } from '../../../security/decorators/current-user.decorator';
import {
  CreateFinancialAccountRequestDto,
  CreateFinancialCategoryRequestDto,
  CreateRecurringPayableRequestDto,
  CreateTitleRequestDto,
  ListFinanceQueryDto,
  ListTitlesQueryDto,
  SettleTitleRequestDto,
  UpdateFinancialAccountRequestDto,
  UpdateFinancialCategoryRequestDto,
} from './dto/finance-request.dto';

/**
 * Financeiro — FIN (§05), fatia 1: contas financeiras + categorias. `@RequireModule(FIN)` no
 * controller; `finance.read` para ler, `finance.settings` para o cadastro (contas e árvore).
 */
@Controller('finance')
@UseGuards(ModuleGuard, PermissionGuard)
@RequireModule(MODULES.FIN)
export class FinanceController {
  constructor(
    private readonly createAccount: CreateFinancialAccountUseCase,
    private readonly listAccounts: ListFinancialAccountsUseCase,
    private readonly updateAccount: UpdateFinancialAccountUseCase,
    private readonly createCategory: CreateFinancialCategoryUseCase,
    private readonly listCategories: ListFinancialCategoriesUseCase,
    private readonly updateCategory: UpdateFinancialCategoryUseCase,
    private readonly createTitle: CreateFinancialTitleUseCase,
    private readonly settleTitle: SettleTitleUseCase,
    private readonly listTitles: ListFinancialTitlesUseCase,
    private readonly createRecurringPayable: CreateRecurringPayableUseCase,
  ) {}

  @Get('accounts')
  @RequirePermission(PERMISSIONS.finance.read)
  async accounts(@Query() query: ListFinanceQueryDto): Promise<FinancialAccountDto[]> {
    return this.listAccounts.execute(
      new ListFinancialAccountsQuery(query.includeInactive ?? false),
    );
  }

  @Post('accounts')
  @RequirePermission(PERMISSIONS.finance.settings)
  async addAccount(
    @Body() dto: CreateFinancialAccountRequestDto,
    @CurrentUser() actor: AuthTokenPayload,
  ): Promise<FinancialAccountDto> {
    return this.createAccount.execute(
      new CreateFinancialAccountCommand(actor.accountId, {
        name: dto.name,
        type: dto.type as FinancialAccountType,
        institution: dto.institution ?? null,
        initialBalance: dto.initialBalance ?? 0,
      }),
    );
  }

  @Patch('accounts/:id')
  @RequirePermission(PERMISSIONS.finance.settings)
  async editAccount(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFinancialAccountRequestDto,
  ): Promise<FinancialAccountDto> {
    return this.updateAccount.execute(
      new UpdateFinancialAccountCommand(id, {
        name: dto.name,
        institution: dto.institution,
        active: dto.active,
      }),
    );
  }

  @Get('categories')
  @RequirePermission(PERMISSIONS.finance.read)
  async categories(@Query() query: ListFinanceQueryDto): Promise<FinancialCategoryDto[]> {
    return this.listCategories.execute(
      new ListFinancialCategoriesQuery(query.includeInactive ?? false),
    );
  }

  @Post('categories')
  @RequirePermission(PERMISSIONS.finance.settings)
  async addCategory(
    @Body() dto: CreateFinancialCategoryRequestDto,
    @CurrentUser() actor: AuthTokenPayload,
  ): Promise<FinancialCategoryDto> {
    return this.createCategory.execute(
      new CreateFinancialCategoryCommand(actor.accountId, {
        name: dto.name,
        kind: dto.kind as CategoryKind,
        parentId: dto.parentId ?? null,
        dreLine: dto.dreLine ?? null,
        defaultOperation: (dto.defaultOperation as CategoryOperation | null) ?? null,
      }),
    );
  }

  @Patch('categories/:id')
  @RequirePermission(PERMISSIONS.finance.settings)
  async editCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFinancialCategoryRequestDto,
  ): Promise<FinancialCategoryDto> {
    return this.updateCategory.execute(
      new UpdateFinancialCategoryCommand(id, {
        name: dto.name,
        parentId: dto.parentId,
        dreLine: dto.dreLine,
        defaultOperation: dto.defaultOperation as CategoryOperation | null | undefined,
        active: dto.active,
      }),
    );
  }

  // ── Títulos a receber (§2.1 do 05) — nascem do lançamento manual no V1 ────────────────────────

  @Get('receivables')
  @RequirePermission(PERMISSIONS.finance.read)
  async receivables(@Query() query: ListTitlesQueryDto): Promise<FinancialTitleDto[]> {
    return this.listTitles.execute(
      new ListFinancialTitlesQuery('receivable', {
        companyId: query.companyId ?? null,
        contactId: query.contactId ?? null,
        status: query.status ?? null,
      }),
    );
  }

  @Post('receivables')
  @RequirePermission(PERMISSIONS.finance.receivable)
  async addReceivable(
    @Body() dto: CreateTitleRequestDto,
    @CurrentUser() actor: AuthTokenPayload,
  ): Promise<FinancialTitleDto> {
    return this.createTitle.execute(
      new CreateFinancialTitleCommand(actor.accountId, 'receivable', {
        companyId: dto.companyId,
        contactId: dto.contactId ?? null,
        categoryId: dto.categoryId ?? null,
        description: dto.description,
        amount: dto.amount,
        issueDate: dto.issueDate ? new Date(dto.issueDate) : null,
        dueDate: new Date(dto.dueDate),
      }),
    );
  }

  @Post('titles/:id/settle')
  @RequirePermission(PERMISSIONS.finance.settle)
  async settle(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SettleTitleRequestDto,
  ): Promise<FinancialTitleDto> {
    return this.settleTitle.execute(
      new SettleTitleCommand(id, {
        financialAccountId: dto.financialAccountId,
        method: dto.method as SettlementMethod,
        principal: dto.principal,
        settledAt: dto.settledAt ? new Date(dto.settledAt) : null,
        interest: dto.interest ?? null,
        fine: dto.fine ?? null,
        discount: dto.discount ?? null,
      }),
    );
  }

  // ── Títulos a pagar (§2.2 do 05) — lançamento manual + recorrência simples ────────────────────

  @Get('payables')
  @RequirePermission(PERMISSIONS.finance.read)
  async payables(@Query() query: ListTitlesQueryDto): Promise<FinancialTitleDto[]> {
    return this.listTitles.execute(
      new ListFinancialTitlesQuery('payable', {
        companyId: query.companyId ?? null,
        contactId: query.contactId ?? null,
        status: query.status ?? null,
      }),
    );
  }

  @Post('payables')
  @RequirePermission(PERMISSIONS.finance.payable)
  async addPayable(
    @Body() dto: CreateTitleRequestDto,
    @CurrentUser() actor: AuthTokenPayload,
  ): Promise<FinancialTitleDto> {
    return this.createTitle.execute(
      new CreateFinancialTitleCommand(actor.accountId, 'payable', {
        companyId: dto.companyId,
        contactId: dto.contactId ?? null,
        categoryId: dto.categoryId ?? null,
        description: dto.description,
        amount: dto.amount,
        issueDate: dto.issueDate ? new Date(dto.issueDate) : null,
        dueDate: new Date(dto.dueDate),
      }),
    );
  }

  @Post('payables/recurring')
  @RequirePermission(PERMISSIONS.finance.payable)
  async addRecurringPayable(
    @Body() dto: CreateRecurringPayableRequestDto,
    @CurrentUser() actor: AuthTokenPayload,
  ): Promise<FinancialTitleDto[]> {
    return this.createRecurringPayable.execute(
      new CreateRecurringPayableCommand(actor.accountId, {
        companyId: dto.companyId,
        contactId: dto.contactId ?? null,
        categoryId: dto.categoryId ?? null,
        description: dto.description,
        amount: dto.amount,
        firstDueDate: new Date(dto.firstDueDate),
        occurrences: dto.occurrences,
      }),
    );
  }
}
