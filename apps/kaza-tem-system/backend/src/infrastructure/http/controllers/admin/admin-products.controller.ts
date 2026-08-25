import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../../guards/admin.guard';
import { ListAdminProductsQuery, ListAdminProductsUseCase } from '@contexts/product/application/use-cases/admin/list-admin-products.use-case';
import { ToggleProductActiveUseCase } from '@contexts/product/application/use-cases/admin/toggle-product-active.use-case';
import { ListProductsQueryDto } from './dto/list-products.query.dto';
import { ProductResponseDto } from '@infrastructure/http/controllers/product/dto/product-response.dto';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/core';
import { MarketplaceApiKeyOrmEntity } from '@infrastructure/persistence/mikro-orm/entities/marketplace-api-key-orm.entity';
import {
  PRODUCT_REPOSITORY,
  ProductRepositoryPort,
} from '@contexts/product/application/ports/output/product-repository.port';

@Controller('api/admin/products')
@UseGuards(AdminGuard)
export class AdminProductsController {
  constructor(
    private readonly listProductsUseCase: ListAdminProductsUseCase,
    private readonly toggleProductActiveUseCase: ToggleProductActiveUseCase,
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: ProductRepositoryPort,
    @InjectRepository(MarketplaceApiKeyOrmEntity)
    private readonly apiKeyRepo: EntityRepository<MarketplaceApiKeyOrmEntity>,
  ) {}

  @Get()
  async list(@Query() query: ListProductsQueryDto) {
    const result = await this.listProductsUseCase.execute(
      new ListAdminProductsQuery(query.page, query.limit, query.search, query.status, query.stock),
    );

    return {
      data: result.products.map(ProductResponseDto.fromDto),
      pagination: result.pagination,
    };
  }

  @Patch(':id/toggle-active')
  async toggleActive(
    @Param('id') id: string,
    @Body('isActive') isActive: boolean,
  ) {
    const productDto = await this.toggleProductActiveUseCase.execute({
      id,
      isActive,
    });

    return {
      data: ProductResponseDto.fromDto(productDto),
    };
  }

  @Get('sync-status')
  async getSyncStatus() {
    const apiKey = await this.apiKeyRepo.findOne({ isActive: true });
    const totalProducts = await this.productRepository.count({ isActive: true });
    const now = Date.now();

    let status = 'not_configured';
    let lastSync: Date | null = null;

    if (!apiKey) {
      return {
        status,
        lastSync,
        totalProducts,
      };
    }

    lastSync = apiKey.lastUsedAt ?? null;
    const minutesAgo = lastSync ? Math.floor((now - lastSync.getTime()) / 60000) : null;

    if (!lastSync) {
      status = 'never_used';
    } else if (minutesAgo !== null) {
      if (minutesAgo < 5) {
        status = 'active';
      } else if (minutesAgo < 60) {
        status = 'slow';
      } else {
        status = 'stopped';
      }
    }

    return {
      status,
      lastSync,
      totalProducts,
    };
  }
}
