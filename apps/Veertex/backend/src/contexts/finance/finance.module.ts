import { Module } from '@nestjs/common';
import { CreateFinancialAccountUseCase } from './application/use-cases/create-financial-account/create-financial-account.use-case';
import { ListFinancialAccountsUseCase } from './application/use-cases/list-financial-accounts/list-financial-accounts.use-case';
import { UpdateFinancialAccountUseCase } from './application/use-cases/update-financial-account/update-financial-account.use-case';
import { CreateFinancialCategoryUseCase } from './application/use-cases/create-financial-category/create-financial-category.use-case';
import { ListFinancialCategoriesUseCase } from './application/use-cases/list-financial-categories/list-financial-categories.use-case';
import { UpdateFinancialCategoryUseCase } from './application/use-cases/update-financial-category/update-financial-category.use-case';
import { SeedFinancialCategoriesUseCase } from './application/use-cases/seed-financial-categories/seed-financial-categories.use-case';

/**
 * FIN — Financeiro (§05). Os repositórios vêm do @Global RepositoriesModule; este módulo cabeia os
 * use cases. Fatia 1: contas financeiras + categorias (com seed no onboarding e mapeamento DRE).
 * `SeedFinancialCategoriesUseCase` é exportado para o onboarding (`create-account`) montar a árvore.
 */
@Module({
  providers: [
    CreateFinancialAccountUseCase,
    ListFinancialAccountsUseCase,
    UpdateFinancialAccountUseCase,
    CreateFinancialCategoryUseCase,
    ListFinancialCategoriesUseCase,
    UpdateFinancialCategoryUseCase,
    SeedFinancialCategoriesUseCase,
  ],
  exports: [
    CreateFinancialAccountUseCase,
    ListFinancialAccountsUseCase,
    UpdateFinancialAccountUseCase,
    CreateFinancialCategoryUseCase,
    ListFinancialCategoriesUseCase,
    UpdateFinancialCategoryUseCase,
    SeedFinancialCategoriesUseCase,
  ],
})
export class FinanceModule {}
