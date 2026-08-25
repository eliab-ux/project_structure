import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  PRODUCT_REPOSITORY,
  ProductFilters,
  ProductRepositoryPort,
} from '../../ports/output/product-repository.port';
import { ProductMapper } from '@infrastructure/persistence/mikro-orm/mappers/product.mapper';
import { ProductDto } from '../../dto/product.dto';

export class ListAdminProductsQuery {
  constructor(
    public readonly page?: number,
    public readonly limit?: number,
    public readonly search?: string,
    public readonly status?: 'active' | 'inactive',
    public readonly stock?: 'in_stock' | 'low_stock' | 'out_of_stock',
  ) {}
}

export interface ListAdminProductsResult {
  products: ProductDto[];
  pagination: {
    total: number;
    totalPages: number;
    currentPage: number;
    perPage: number;
  };
}

@Injectable()
export class ListAdminProductsUseCase
  implements UseCase<ListAdminProductsQuery, ListAdminProductsResult>
{
  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: ProductRepositoryPort,
    private readonly productMapper: ProductMapper,
  ) {}

  async execute(
    query: ListAdminProductsQuery,
  ): Promise<ListAdminProductsResult> {
    const limit = Math.min(query.limit ?? 20, 100);
    const currentPage = Math.max(query.page ?? 1, 1);
    const offset = (currentPage - 1) * limit;

    const filters: ProductFilters = {
      limit,
      offset,
    };

    if (query.search) {
      filters.searchTerm = query.search.trim();
    }

    if (query.status) {
      filters.isActive = query.status === 'active';
    }

    if (query.stock) {
      switch (query.stock) {
        case 'in_stock':
          filters.minStock = 1;
          break;
        case 'low_stock':
          filters.minStock = 1;
          filters.maxStock = 10;
          break;
        case 'out_of_stock':
          filters.maxStock = 0;
          break;
      }
    }

    const [products, total] = await Promise.all([
      this.productRepository.findAll(filters),
      this.productRepository.count(this.cloneFilters(filters)),
    ]);

    return {
      products: products.map((entry) =>
        this.productMapper.toDtoWithImages(entry.product, entry.images),
      ),
      pagination: {
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        currentPage,
        perPage: limit,
      },
    };
  }

  private cloneFilters(filters: ProductFilters): ProductFilters {
    const copy: ProductFilters = { ...filters };
    delete copy.limit;
    delete copy.offset;
    return copy;
  }
}
