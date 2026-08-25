import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  PRODUCT_REPOSITORY,
  ProductRepositoryPort,
} from '../../ports/output/product-repository.port';
import { ProductMapper } from '@infrastructure/persistence/mikro-orm/mappers/product.mapper';
import { ProductDto } from '../../dto/product.dto';
import { ProductId } from '../../../domain/value-objects/product-id.vo';
import { ProductNotFoundException } from '../../../domain/exceptions/product-not-found.exception';

export class GetProductQuery {
  constructor(public readonly productId: string) {}
}

@Injectable()
export class GetProductByIdUseCase implements UseCase<GetProductQuery, ProductDto> {
  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: ProductRepositoryPort,
    private readonly productMapper: ProductMapper,
  ) {}

  async execute(query: GetProductQuery): Promise<ProductDto> {
    const productId = ProductId.from(query.productId);
    const entry = await this.productRepository.findById(productId);

    if (!entry) {
      throw new ProductNotFoundException(query.productId);
    }

    return this.productMapper.toDtoWithImages(entry.product, entry.images);
  }
}
