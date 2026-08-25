import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { ProductNotFoundException } from '../../../domain/exceptions/product-not-found.exception';
import { ProductId } from '../../../domain/value-objects/product-id.vo';
import {
  PRODUCT_REPOSITORY,
  ProductRepositoryPort,
} from '../../ports/output/product-repository.port';
import { UnitOfWorkPort, UNIT_OF_WORK } from '@infrastructure/persistence/ports/unit-of-work.port';

export class DeactivateProductMarketplaceCommand {
  constructor(public readonly id: string) {}
}

@Injectable()
export class DeactivateProductFromMarketplaceUseCase
  implements UseCase<DeactivateProductMarketplaceCommand, void>
{
  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: ProductRepositoryPort,
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(command: DeactivateProductMarketplaceCommand): Promise<void> {
    const productId = ProductId.from(command.id);
    const existing = await this.productRepository.findById(productId);

    if (!existing) {
      throw new ProductNotFoundException(command.id);
    }

    existing.product.deactivate();

    await this.unitOfWork.execute(async () => {
      await this.productRepository.save(existing.product);
    });
  }
}
