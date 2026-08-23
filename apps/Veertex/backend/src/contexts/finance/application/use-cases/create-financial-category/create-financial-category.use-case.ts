import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import {
  FINANCIAL_CATEGORY_REPOSITORY,
  FinancialCategoryRepositoryPort,
} from '../../ports/output/financial-category-repository.port';
import { FinancialCategory } from '../../../domain/entities/financial-category.entity';
import { CategoryKind, CategoryOperation } from '../../../domain/category-kind';
import { FinancialCategoryDto } from '../../dto/finance.dto';

export class CreateFinancialCategoryCommand {
  constructor(
    public readonly accountId: string,
    public readonly input: {
      name: string;
      kind: CategoryKind;
      parentId?: string | null;
      dreLine?: string | null;
      defaultOperation?: CategoryOperation | null;
    },
  ) {}
}

/** Cria uma categoria financeira (§2.4 do 05), com mapeamento de DRE e default por operação. */
@Injectable()
export class CreateFinancialCategoryUseCase implements UseCase<
  CreateFinancialCategoryCommand,
  FinancialCategoryDto
> {
  constructor(
    @Inject(FINANCIAL_CATEGORY_REPOSITORY)
    private readonly categories: FinancialCategoryRepositoryPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: CreateFinancialCategoryCommand): Promise<FinancialCategoryDto> {
    const category = FinancialCategory.create({
      accountId: command.accountId,
      name: command.input.name,
      kind: command.input.kind,
      parentId: command.input.parentId ?? null,
      dreLine: command.input.dreLine ?? null,
      defaultOperation: command.input.defaultOperation ?? null,
    });
    return this.uow.execute(async () => {
      const saved = await this.categories.save(category);
      return FinancialCategoryDto.fromDomain(saved);
    });
  }
}
