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
  FinancialAccountDto,
  FinancialCategoryDto,
} from '../../../../contexts/finance/application/dto/finance.dto';
import { FinancialAccountType } from '../../../../contexts/finance/domain/financial-account-type';
import { CategoryKind, CategoryOperation } from '../../../../contexts/finance/domain/category-kind';
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
  ListFinanceQueryDto,
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
}
