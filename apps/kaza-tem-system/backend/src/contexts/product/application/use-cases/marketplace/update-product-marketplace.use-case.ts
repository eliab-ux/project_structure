import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { Price } from '../../../domain/value-objects/price.vo';
import { ProductNotFoundException } from '../../../domain/exceptions/product-not-found.exception';
import { Stock } from '../../../domain/value-objects/stock.vo';
import {
  PRODUCT_IMAGE_REPOSITORY,
  ProductImagePayload,
  ProductImageRepositoryPort,
} from '../../ports/output/product-image-repository.port';
import {
  PRODUCT_REPOSITORY,
  ProductRepositoryPort,
  ProductWithImages,
} from '../../ports/output/product-repository.port';
import { UnitOfWorkPort, UNIT_OF_WORK } from '@infrastructure/persistence/ports/unit-of-work.port';
import { ProductId } from '../../../domain/value-objects/product-id.vo';

export interface UpdateProductMarketplaceCommand {
  id: string;
  name?: string;
  description?: string;
  price?: number;
  costPrice?: number;
  stock?: number;
  categoryName?: string | null;
  weight?: number;
  dimensions?: {
    width?: number;
    height?: number;
    length?: number;
  };
  isActive?: boolean;
  images?: {
    url: string;
    position?: number;
    is_primary?: boolean;
  }[];
}

@Injectable()
export class UpdateProductFromMarketplaceUseCase
  implements UseCase<UpdateProductMarketplaceCommand, ProductWithImages>
{
  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: ProductRepositoryPort,
    @Inject(PRODUCT_IMAGE_REPOSITORY)
    private readonly productImageRepository: ProductImageRepositoryPort,
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(
    command: UpdateProductMarketplaceCommand,
  ): Promise<ProductWithImages> {
    const productId = ProductId.from(command.id);
    const existing = await this.productRepository.findById(productId);

    if (!existing) {
      throw new ProductNotFoundException(command.id);
    }

    const product = existing.product;

    if (command.price !== undefined) {
      product.updatePrice(Price.create(command.price));
    }

    if (command.costPrice !== undefined) {
      product.updateDetails({
        costPrice: Price.create(command.costPrice),
      });
    }

    if (command.stock !== undefined) {
      product.updateStock(Stock.create(command.stock));
    }

    if (command.isActive !== undefined) {
      product.setActiveState(command.isActive);
    }

    const detailUpdates: {
      name?: string;
      description?: string;
      categoryName?: string | null;
      weight?: number;
      width?: number;
      height?: number;
      length?: number;
    } = {};

    if (command.name !== undefined) {
      detailUpdates.name = command.name;
    }
    if (command.description !== undefined) {
      detailUpdates.description = command.description;
    }
    if (command.categoryName !== undefined) {
      detailUpdates.categoryName = command.categoryName;
    }
    if (command.weight !== undefined) {
      detailUpdates.weight = command.weight;
    }
    if (command.dimensions?.width !== undefined) {
      detailUpdates.width = command.dimensions.width;
    }
    if (command.dimensions?.height !== undefined) {
      detailUpdates.height = command.dimensions.height;
    }
    if (command.dimensions?.length !== undefined) {
      detailUpdates.length = command.dimensions.length;
    }

    if (Object.keys(detailUpdates).length > 0) {
      product.updateDetails(detailUpdates);
    }

    await this.unitOfWork.execute(async () => {
      await this.productRepository.save(product);

      if (command.images && command.images.length > 0) {
        const payload: ProductImagePayload[] = command.images.map((image, index) => ({
          url: image.url,
          position: image.position ?? index,
          isPrimary: image.is_primary ?? false,
        }));

        await this.productImageRepository.replaceForProduct(product.id.value, payload);
      }
    });

    const updated = await this.productRepository.findById(product.id);

    if (!updated) {
      throw new InternalServerErrorException('Product disappeared after update');
    }

    return updated;
  }
}
