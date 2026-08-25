import { ConflictException, Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { Price } from '../../../domain/value-objects/price.vo';
import { Product } from '../../../domain/entities/product.entity';
import { SKU } from '../../../domain/value-objects/sku.vo';
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

export interface CreateProductMarketplaceCommand {
  sku: string;
  name: string;
  description?: string;
  price: number;
  costPrice?: number;
  stock: number;
  categoryName?: string;
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
export class CreateProductFromMarketplaceUseCase
  implements UseCase<CreateProductMarketplaceCommand, ProductWithImages>
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
    command: CreateProductMarketplaceCommand,
  ): Promise<ProductWithImages> {
    const sku = SKU.create(command.sku);
    const existing = await this.productRepository.findBySKU(sku);
    if (existing) {
      throw new ConflictException(`Product with SKU ${command.sku} already exists`);
    }

    const product = Product.create(
      sku,
      command.name,
      command.description || '',
      Price.create(command.price),
      Price.create(command.costPrice ?? 0),
      Stock.create(command.stock),
      command.categoryName,
      command.weight ?? 0,
      command.dimensions?.width ?? 0,
      command.dimensions?.height ?? 0,
      command.dimensions?.length ?? 0,
    );

    if (command.isActive === false) {
      product.setActiveState(false);
    }

    let savedProduct: Product | null = null as Product | null;

    await this.unitOfWork.execute(async () => {
      savedProduct = await this.productRepository.save(product);

      if (command.images && command.images.length > 0 && savedProduct) {
        const payload: ProductImagePayload[] = command.images.map((image, index) => ({
          url: image.url,
          position: image.position ?? index,
          isPrimary: image.is_primary ?? false,
        }));

        await this.productImageRepository.replaceForProduct(savedProduct.id.value, payload);
      }
    });

    if (!savedProduct) {
      throw new InternalServerErrorException('Failed to create product');
    }

    const result = await this.productRepository.findById((savedProduct as Product).id);

    if (!result) {
      throw new InternalServerErrorException('Created product could not be loaded');
    }

    return result;
  }
}
