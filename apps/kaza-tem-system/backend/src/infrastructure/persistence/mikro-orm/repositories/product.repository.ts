import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityManager, EntityRepository } from '@mikro-orm/core';
import {
  ProductFilters,
  ProductImageInfo,
  ProductRepositoryPort,
  ProductWithImages,
} from '../../../../contexts/product/application/ports/output/product-repository.port';
import { Product } from '../../../../contexts/product/domain/entities/product.entity';
import { ProductId } from '../../../../contexts/product/domain/value-objects/product-id.vo';
import { SKU } from '../../../../contexts/product/domain/value-objects/sku.vo';
import { ProductOrmEntity } from '../entities/product-orm.entity';
import { ProductMapper } from '../mappers/product.mapper';
import { EVENT_PUBLISHER, EventPublisherPort } from '../../ports/event-publisher.port';

@Injectable()
export class MikroOrmProductRepository implements ProductRepositoryPort {
  constructor(
    @InjectRepository(ProductOrmEntity)
    private readonly repository: EntityRepository<ProductOrmEntity>,
    private readonly em: EntityManager,
    private readonly mapper: ProductMapper,
    @Inject(EVENT_PUBLISHER)
    private readonly eventPublisher: EventPublisherPort,
  ) {}

  async save(product: Product): Promise<Product> {
    const ormEntity = this.mapper.toOrm(product);
    await this.em.persistAndFlush(ormEntity);

    const events = product.pullDomainEvents();
    if (events.length > 0) {
      await this.eventPublisher.publishAll(events);
    }

    return this.mapper.toDomain(ormEntity);
  }

  async findById(id: ProductId): Promise<ProductWithImages | null> {
    const ormEntity = await this.repository.findOne({ id: id.value }, { populate: ['images'] });
    return ormEntity ? this.mapOrmToProductWithImages(ormEntity) : null;
  }

  async findBySKU(sku: SKU): Promise<ProductWithImages | null> {
    const ormEntity = await this.repository.findOne({ sku: sku.value }, { populate: ['images'] });
    return ormEntity ? this.mapOrmToProductWithImages(ormEntity) : null;
  }

  async findAll(filters?: ProductFilters): Promise<ProductWithImages[]> {
    const where = this.buildWhere(filters);
    const ormEntities = await this.repository.find(where, {
      limit: filters?.limit,
      offset: filters?.offset,
      orderBy: { name: 'ASC' },
      populate: ['images'],
    });

    return ormEntities.map((entity) => this.mapOrmToProductWithImages(entity));
  }

  async count(filters?: ProductFilters): Promise<number> {
    const where = this.buildWhere(filters);
    return this.repository.count(where);
  }

  private buildWhere(filters?: ProductFilters): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters?.categoryName) {
      where.categoryName = filters.categoryName;
    }

    const priceFilters: Record<string, number> = {};
    if (filters?.minPrice !== undefined) {
      priceFilters.$gte = filters.minPrice;
    }
    if (filters?.maxPrice !== undefined) {
      priceFilters.$lte = filters.maxPrice;
    }
    if (Object.keys(priceFilters).length > 0) {
      where.price = priceFilters;
    }

    if (filters?.searchTerm) {
      where.name = { $ilike: `%${filters.searchTerm}%` };
    }

    const stockConditions: Record<string, number> = {};
    if (filters?.inStock) {
      stockConditions.$gt = 0;
    }
    if (filters?.minStock !== undefined) {
      stockConditions.$gte = filters.minStock;
    }
    if (filters?.maxStock !== undefined) {
      stockConditions.$lte = filters.maxStock;
    }
    if (Object.keys(stockConditions).length > 0) {
      const existingStock = (where.stock as Record<string, number>) ?? {};
      where.stock = { ...existingStock, ...stockConditions };
    }

    if (filters?.updatedSince) {
      where.updatedAt = { $gte: filters.updatedSince };
    }

    return where;
  }

  async findByCategory(categoryName: string): Promise<ProductWithImages[]> {
    const ormEntities = await this.repository.find(
      { categoryName, isActive: true },
      { populate: ['images'] },
    );
    return ormEntities.map((entity) => this.mapOrmToProductWithImages(entity));
  }

  async searchByName(query: string): Promise<ProductWithImages[]> {
    const ormEntities = await this.repository.find(
      {
        name: { $ilike: `%${query}%` },
        isActive: true,
      },
      { populate: ['images'] },
    );
    return ormEntities.map((entity) => this.mapOrmToProductWithImages(entity));
  }

  async delete(id: ProductId): Promise<void> {
    await this.repository.nativeDelete({ id: id.value });
  }

  private mapOrmToProductWithImages(ormEntity: ProductOrmEntity): ProductWithImages {
    const product = this.mapper.toDomain(ormEntity);
    const images: ProductImageInfo[] = ormEntity.images.getItems().map((image) => ({
      url: image.url,
      position: image.position,
      isPrimary: image.isPrimary,
    }));
    return { product, images };
  }
}
