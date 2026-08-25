import { Product } from '../../domain/entities/product.entity';

export class ProductDto {
  id!: string;
  sku!: string;
  name!: string;
  description!: string;
  price!: number;
  costPrice!: number;
  stock!: number;
  categoryName!: string | null;
  weight!: number;
  width!: number;
  height!: number;
  length!: number;
  isActive!: boolean;
  images?: string[];
  primaryImage?: string | null;
  createdAt!: Date;
  updatedAt!: Date;

  static fromDomain(product: Product): ProductDto {
    const dto = new ProductDto();
    dto.id = product.id.value;
    dto.sku = product.sku.value;
    dto.name = product.name;
    dto.description = product.description;
    dto.price = product.price.value;
    dto.costPrice = product.costPrice.value;
    dto.stock = product.stock.value;
    dto.categoryName = product.categoryName;
    dto.weight = product.weight;
    dto.width = product.width;
    dto.height = product.height;
    dto.length = product.length;
    dto.isActive = product.isActive;
    dto.createdAt = product.createdAt;
    dto.updatedAt = product.updatedAt;
    return dto;
  }
}
