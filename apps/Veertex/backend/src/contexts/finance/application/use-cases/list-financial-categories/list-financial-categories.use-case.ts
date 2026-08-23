import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  FINANCIAL_CATEGORY_REPOSITORY,
  FinancialCategoryRepositoryPort,
} from '../../ports/output/financial-category-repository.port';
import { FinancialCategoryDto } from '../../dto/finance.dto';

export class ListFinancialCategoriesQuery {
  constructor(public readonly includeInactive: boolean = false) {}
}

/** Lista a árvore de categorias da conta (§2.4 do 05). A hierarquia é montada no cliente por parentId. */
@Injectable()
export class ListFinancialCategoriesUseCase implements UseCase<
  ListFinancialCategoriesQuery,
  FinancialCategoryDto[]
> {
  constructor(
    @Inject(FINANCIAL_CATEGORY_REPOSITORY)
    private readonly categories: FinancialCategoryRepositoryPort,
  ) {}

  async execute(query: ListFinancialCategoriesQuery): Promise<FinancialCategoryDto[]> {
    const categories = await this.categories.list(query.includeInactive);
    return categories.map(FinancialCategoryDto.fromDomain);
  }
}
