import { ProductDto } from '@contexts/product/application/dto/product.dto';

export class ProductResponseDto {
  id!: string;
  sku!: string;
  name!: string;
  description!: string;
  price!: number;
  costPrice!: number;
  stock!: number;
  categoryName!: string | null;
  isActive!: boolean;
  images?: string[];
  primaryImage?: string | null;
  createdAt!: Date;
  updatedAt!: Date;

  static fromDto(dto: ProductDto): ProductResponseDto {
    const response = new ProductResponseDto();
    response.id = dto.id;
    response.sku = dto.sku;
    response.name = dto.name;
    response.description = dto.description;
    response.price = dto.price;
    response.costPrice = dto.costPrice;
    response.stock = dto.stock;
    response.categoryName = dto.categoryName;
    response.isActive = dto.isActive;
    response.images = dto.images;
    response.primaryImage = dto.primaryImage ?? null;
    response.createdAt = dto.createdAt;
    response.updatedAt = dto.updatedAt;
    return response;
  }
}
