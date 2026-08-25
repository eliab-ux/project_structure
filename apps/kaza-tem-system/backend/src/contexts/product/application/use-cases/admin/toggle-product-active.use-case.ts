import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { ProductId } from '../../domain/value-objects/product-id.vo';
import { ProductNotFoundException } from '../../domain/exceptions/product-not-found.exception';
import {
  PRODUCT_REPOSITORY,
  ProductRepositoryPort,
} from '../../ports/output/product-repository.port';
import { UnitOfWorkPort, UNIT_OF_WORK } from '@infrastructure/persistence/ports/unit-of-work.port';
import { ProductMapper } from '@infrastructure/persistence/mikro-orm/mappers/product.mapper';
import { ProductDto } from '../../dto/product.dto';

export interface ToggleProductActiveCommand {
  id: string;
  isActive: boolean;
}

@Injectable()
export class ToggleProductActiveUseCase
  implements UseCase<ToggleProductActiveCommand, ProductDto>
{
  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: ProductRepositoryPort,
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: UnitOfWorkPort,
    private readonly productMapper: ProductMapper,
  ) {}

  async execute(command: ToggleProductActiveCommand): Promise<ProductDto> {
    const productId = ProductId.from(command.id);
    const existing = await this.productRepository.findById(productId);

    if (!existing) {
      throw new ProductNotFoundException(command.id);
    }

    existing.product.setActiveState(command.isActive);

    await this.unitOfWork.execute(async () => {
      await this.productRepository.save(existing.product);
    });

    const updated = await this.productRepository.findById(productId);

    if (!updated) {
      throw new InternalServerErrorException('Product disappeared after update');
    }

    return this.productMapper.toDtoWithImages(updated.product, updated.images);
  }
}
