import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MarketplaceAuthGuard } from '../../guards/marketplace-auth.guard';
import { UpdateProductFromMarketplaceUseCase } from '../../../../contexts/product/application/use-cases/marketplace/update-product-marketplace.use-case';
import { CreateProductFromMarketplaceUseCase } from '../../../../contexts/product/application/use-cases/marketplace/create-product-marketplace.use-case';
import { ListProductsForMarketplaceUseCase } from '../../../../contexts/product/application/use-cases/marketplace/list-products-marketplace.use-case';
import { DeactivateProductFromMarketplaceUseCase } from '../../../../contexts/product/application/use-cases/marketplace/deactivate-product-marketplace.use-case';
import { ListProductsMarketplaceQueryDto } from './dto/list-products-marketplace-query.dto';
import { CreateProductMarketplaceDto } from './dto/create-product-marketplace.dto';
import { UpdateProductMarketplaceDto } from './dto/update-product-marketplace.dto';
import { ListProductsMarketplaceQuery } from '../../../../contexts/product/application/use-cases/marketplace/list-products-marketplace.use-case';
import { CreateProductMarketplaceCommand } from '../../../../contexts/product/application/use-cases/marketplace/create-product-marketplace.use-case';
import { UpdateProductMarketplaceCommand } from '../../../../contexts/product/application/use-cases/marketplace/update-product-marketplace.use-case';
import { DeactivateProductMarketplaceCommand } from '../../../../contexts/product/application/use-cases/marketplace/deactivate-product-marketplace.use-case';
import {
  PRODUCT_REPOSITORY,
  ProductRepositoryPort,
  ProductWithImages,
} from '../../../../contexts/product/application/ports/output/product-repository.port';
import { ProductId } from '../../../../contexts/product/domain/value-objects/product-id.vo';

@Controller('api/v1/products')
@UseGuards(MarketplaceAuthGuard)
export class MarketplaceProductsController {
  constructor(
    private readonly listProductsUseCase: ListProductsForMarketplaceUseCase,
    private readonly createProductUseCase: CreateProductFromMarketplaceUseCase,
    private readonly updateProductUseCase: UpdateProductFromMarketplaceUseCase,
    private readonly deactivateProductUseCase: DeactivateProductFromMarketplaceUseCase,
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: ProductRepositoryPort,
  ) {}

  @Get()
  async list(@Query() query: ListProductsMarketplaceQueryDto) {
    const listQuery = new ListProductsMarketplaceQuery(
      query.page,
      query.limit,
      query.updated_since,
    );

    const result = await this.listProductsUseCase.execute(listQuery);

    return {
      success: true,
      data: result.products.map((entry) => this.toApiResponse(entry)),
      pagination: {
        total: result.pagination.total,
        total_pages: result.pagination.totalPages,
        current_page: result.pagination.currentPage,
        per_page: result.pagination.perPage,
      },
    };
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    const entry = await this.productRepository.findById(ProductId.from(id));
    if (!entry) {
      throw new NotFoundException(`Product ${id} not found`);
    }

    return {
      success: true,
      data: this.toApiResponse(entry),
    };
  }

  @Post()
  async create(@Body() dto: CreateProductMarketplaceDto) {
    const command: CreateProductMarketplaceCommand = {
      sku: dto.sku,
      name: dto.name,
      description: dto.description,
      price: dto.price,
      costPrice: dto.cost_price,
      stock: dto.stock,
      categoryName: dto.category_name,
      weight: dto.weight,
      dimensions: dto.dimensions
        ? {
            width: dto.dimensions.width,
            height: dto.dimensions.height,
            length: dto.dimensions.length,
          }
        : undefined,
      isActive: dto.is_active,
      images: dto.images?.map((image) => ({
        url: image.url,
        position: image.position,
        is_primary: image.is_primary,
      })),
    };

    const created = await this.createProductUseCase.execute(command);

    return {
      success: true,
      data: this.toApiResponse(created),
      message: 'Product created successfully',
    };
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateProductMarketplaceDto) {
    const command: UpdateProductMarketplaceCommand = {
      id,
      name: dto.name,
      description: dto.description,
      price: dto.price,
      costPrice: dto.cost_price,
      stock: dto.stock,
      categoryName: dto.category_name ?? undefined,
      weight: dto.weight,
      dimensions: dto.dimensions
        ? {
            width: dto.dimensions.width,
            height: dto.dimensions.height,
            length: dto.dimensions.length,
          }
        : undefined,
      isActive: dto.is_active,
      images: dto.images?.map((image) => ({
        url: image.url,
        position: image.position,
        is_primary: image.is_primary,
      })),
    };

    const updated = await this.updateProductUseCase.execute(command);

    return {
      success: true,
      data: this.toApiResponse(updated),
      message: 'Product updated successfully',
    };
  }

  @Delete(':id')
  async deactivate(@Param('id') id: string) {
    const command = new DeactivateProductMarketplaceCommand(id);
    await this.deactivateProductUseCase.execute(command);

    return {
      success: true,
      message: 'Product deactivated successfully',
    };
  }

  private toApiResponse(entry: ProductWithImages) {
    const product = entry.product;
    return {
      id: product.id.value,
      sku: product.sku.value,
      name: product.name,
      description: product.description,
      price: product.price.value,
      cost_price: product.costPrice.value,
      stock: product.stock.value,
      category_name: product.categoryName,
      weight: product.weight,
      dimensions: {
        width: product.width,
        height: product.height,
        length: product.length,
      },
      is_active: product.isActive,
      images: entry.images.map((image) => ({
        url: image.url,
        position: image.position,
        is_primary: image.isPrimary,
      })),
      created_at: product.createdAt.toISOString(),
      updated_at: product.updatedAt.toISOString(),
    };
  }
}
