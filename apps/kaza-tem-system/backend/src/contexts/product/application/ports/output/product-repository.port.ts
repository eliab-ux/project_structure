import { Product } from '../../../domain/entities/product.entity';
import { ProductId } from '../../../domain/value-objects/product-id.vo';
import { SKU } from '../../../domain/value-objects/sku.vo';

export const PRODUCT_REPOSITORY = Symbol('PRODUCT_REPOSITORY');

export interface ProductFilters {
  isActive?: boolean;
  categoryName?: string;
  minPrice?: number;
  maxPrice?: number;
  searchTerm?: string;
  inStock?: boolean;
  minStock?: number;
  maxStock?: number;
  limit?: number;
  offset?: number;
  updatedSince?: Date;
}

export interface ProductImageInfo {
  url: string;
  position: number;
  isPrimary: boolean;
}

export interface ProductWithImages {
  product: Product;
  images: ProductImageInfo[];
}

export interface ProductRepositoryPort {
  save(product: Product): Promise<Product>;
  findById(id: ProductId): Promise<ProductWithImages | null>;
  findBySKU(sku: SKU): Promise<ProductWithImages | null>;
  findAll(filters?: ProductFilters): Promise<ProductWithImages[]>;
  findByCategory(categoryName: string): Promise<ProductWithImages[]>;
  searchByName(query: string): Promise<ProductWithImages[]>;
  delete(id: ProductId): Promise<void>;
  count(filters?: ProductFilters): Promise<number>;
}
