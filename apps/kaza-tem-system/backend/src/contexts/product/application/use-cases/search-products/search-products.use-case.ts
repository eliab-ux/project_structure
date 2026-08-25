import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  PRODUCT_REPOSITORY,
  ProductFilters,
  ProductRepositoryPort,
} from '../../ports/output/product-repository.port';
import { ProductMapper } from '@infrastructure/persistence/mikro-orm/mappers/product.mapper';
import { ProductDto } from '../../dto/product.dto';

export class SearchProductsQuery {
  constructor(
    public readonly searchTerm?: string,
    public readonly categoryName?: string,
    public readonly minPrice?: number,
    public readonly maxPrice?: number,
    public readonly limit?: number,
    public readonly offset?: number,
    public readonly onlyInStock?: boolean,
  ) {}
}

@Injectable()
export class SearchProductsUseCase implements UseCase<SearchProductsQuery, ProductDto[]> {
  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: ProductRepositoryPort,
    private readonly productMapper: ProductMapper,
  ) {}

  async execute(query: SearchProductsQuery): Promise<ProductDto[]> {
    const filters: ProductFilters = {
      categoryName: query.categoryName,
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
      limit: query.limit,
      offset: query.offset,
      inStock: query.onlyInStock,
    };

    let products = query.searchTerm
      ? await this.productRepository.searchByName(query.searchTerm)
      : await this.productRepository.findAll(filters);

    if (query.searchTerm && (query.categoryName || query.minPrice || query.maxPrice)) {
      products = products.filter((entry) => {
        const product = entry.product;
        if (query.categoryName && product.categoryName !== query.categoryName) {
          return false;
        }
        if (query.minPrice && product.price.value < query.minPrice) {
          return false;
        }
        if (query.maxPrice && product.price.value > query.maxPrice) {
          return false;
        }
        return true;
      });
    }

    return products.map((entry) =>
      this.productMapper.toDtoWithImages(entry.product, entry.images),
    );
  }
}
