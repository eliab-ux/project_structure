import { Injectable } from '@nestjs/common';
import { Product } from '../../../../contexts/product/domain/entities/product.entity';
import { ProductDto } from '../../../../contexts/product/application/dto/product.dto';
import { ProductOrmEntity } from '../entities/product-orm.entity';
import { ProductId } from '../../../../contexts/product/domain/value-objects/product-id.vo';
import { SKU } from '../../../../contexts/product/domain/value-objects/sku.vo';
import { Price } from '../../../../contexts/product/domain/value-objects/price.vo';
import { Stock } from '../../../../contexts/product/domain/value-objects/stock.vo';
import { ProductImageInfo } from '../../../../contexts/product/application/ports/output/product-repository.port';

@Injectable()
export class ProductMapper {
  toDomain(orm: ProductOrmEntity): Product {
    return Product.reconstitute(
      ProductId.from(orm.id),
      SKU.create(orm.sku),
      orm.name,
      orm.description || '',
      Price.create(orm.price),
      Price.create(orm.costPrice || 0),
      Stock.create(orm.stock),
      orm.categoryName || null,
      orm.isActive,
      orm.createdAt,
      orm.updatedAt,
      orm.weight ?? 0,
      orm.width ?? 0,
      orm.height ?? 0,
      orm.length ?? 0,
    );
  }

  toOrm(domain: Product): ProductOrmEntity {
    const orm = new ProductOrmEntity();
    orm.id = domain.id.value;
    orm.sku = domain.sku.value;
    orm.name = domain.name;
    orm.description = domain.description;
    orm.price = domain.price.value;
    orm.costPrice = domain.costPrice.value;
    orm.stock = domain.stock.value;
    orm.categoryName = domain.categoryName ?? undefined;
    orm.isActive = domain.isActive;
    orm.createdAt = domain.createdAt;
    orm.updatedAt = domain.updatedAt;
    orm.weight = domain.weight;
    orm.width = domain.width;
    orm.height = domain.height;
    orm.length = domain.length;
    return orm;
  }

  toDtoWithImages(product: Product, images: ProductImageInfo[]): ProductDto {
    const dto = ProductDto.fromDomain(product);
    dto.images = images.map((image) => image.url);
    dto.primaryImage = images.find((image) => image.isPrimary)?.url ?? (images[0]?.url ?? null);
    return dto;
  }
}
