import { EntityManager } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import {
  ProductImagePayload,
  ProductImageRepositoryPort,
} from '../../../../contexts/product/application/ports/output/product-image-repository.port';
import { ProductImageOrmEntity } from '../entities/product-image-orm.entity';
import { ProductOrmEntity } from '../entities/product-orm.entity';

@Injectable()
export class MikroOrmProductImageRepository implements ProductImageRepositoryPort {
  constructor(private readonly em: EntityManager) {}

  async replaceForProduct(productId: string, images: ProductImagePayload[]): Promise<void> {
    await this.em.nativeDelete(ProductImageOrmEntity, { product: productId });

    const productRef = this.em.getReference(ProductOrmEntity, productId);

    const entities = images.map((image) => {
      const ormImage = new ProductImageOrmEntity();
      ormImage.product = productRef;
      ormImage.url = image.url;
      ormImage.position = image.position;
      ormImage.isPrimary = image.isPrimary;
      return ormImage;
    });

    if (entities.length === 0) {
      return;
    }

    await this.em.persistAndFlush(entities);
  }
}
