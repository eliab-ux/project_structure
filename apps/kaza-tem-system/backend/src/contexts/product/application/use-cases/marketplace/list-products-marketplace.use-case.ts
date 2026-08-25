import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  PRODUCT_REPOSITORY,
  ProductFilters,
  ProductRepositoryPort,
  ProductWithImages,
} from '../../ports/output/product-repository.port';

export class ListProductsMarketplaceQuery {
  constructor(
    public readonly page?: number,
    public readonly limit?: number,
    public readonly updatedSince?: string,
  ) {}
}

export interface ListProductsMarketplaceResult {
  products: ProductWithImages[];
  pagination: {
    total: number;
    totalPages: number;
    currentPage: number;
    perPage: number;
  };
}

@Injectable()
export class ListProductsForMarketplaceUseCase
  implements UseCase<ListProductsMarketplaceQuery, ListProductsMarketplaceResult>
{
  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: ProductRepositoryPort,
  ) {}

  async execute(
    query: ListProductsMarketplaceQuery,
  ): Promise<ListProductsMarketplaceResult> {
    const limit = Math.min(query.limit ?? 100, 100);
    const currentPage = Math.max(query.page ?? 1, 1);
    const updatedSince = query.updatedSince ? new Date(query.updatedSince) : undefined;

    const baseFilters: ProductFilters = {
      isActive: true,
      updatedSince,
    };

    const paginatedFilters: ProductFilters = {
      ...baseFilters,
      limit,
      offset: (currentPage - 1) * limit,
    };

    const products = await this.productRepository.findAll(paginatedFilters);
    const total = await this.productRepository.count(baseFilters);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    return {
      products,
      pagination: {
        total,
        totalPages,
        currentPage,
        perPage: limit,
      },
    };
  }
}
