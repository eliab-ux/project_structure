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
import { CategoryOperation } from '../../../domain/category-kind';
import { FinancialCategoryDto } from '../../dto/finance.dto';
import { FinancialCategoryNotFoundException } from '../../../domain/exceptions/finance-exceptions';

export class UpdateFinancialCategoryCommand {
  constructor(
    public readonly id: string,
    public readonly input: {
      name?: string;
      parentId?: string | null;
      dreLine?: string | null;
      defaultOperation?: CategoryOperation | null;
      active?: boolean;
    },
  ) {}
}

/** Edita/desativa uma categoria (§2.4 do 05). O `kind` (receita/despesa/neutra) não muda por aqui. */
@Injectable()
export class UpdateFinancialCategoryUseCase implements UseCase<
  UpdateFinancialCategoryCommand,
  FinancialCategoryDto
> {
  constructor(
    @Inject(FINANCIAL_CATEGORY_REPOSITORY)
    private readonly categories: FinancialCategoryRepositoryPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: UpdateFinancialCategoryCommand): Promise<FinancialCategoryDto> {
    return this.uow.execute(async () => {
      const category = await this.categories.findById(command.id);
      if (!category) {
        throw new FinancialCategoryNotFoundException();
      }
      category.edit(command.input);
      const saved = await this.categories.save(category);
      return FinancialCategoryDto.fromDomain(saved);
    });
  }
}
