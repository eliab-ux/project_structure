import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '@infrastructure/security/guards/admin.guard';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityManager, EntityRepository } from '@mikro-orm/core';
import { HttpService } from '@nestjs/axios';
import { randomBytes, createHmac } from 'crypto';
import { MarketplaceApiKeyOrmEntity } from '@infrastructure/persistence/mikro-orm/entities/marketplace-api-key-orm.entity';
import {
  PRODUCT_REPOSITORY,
  ProductRepositoryPort,
} from '@contexts/product/application/ports/output/product-repository.port';

@Controller('api/admin/marketplace')
@UseGuards(AdminGuard)
export class AdminMarketplaceController {
  constructor(
    @InjectRepository(MarketplaceApiKeyOrmEntity)
    private readonly apiKeyRepo: EntityRepository<MarketplaceApiKeyOrmEntity>,
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: ProductRepositoryPort,
    private readonly httpService: HttpService,
    private readonly em: EntityManager,
  ) {}

  @Get('config')
  async getConfig() {
    const apiKey = await this.apiKeyRepo.findOne({ isActive: true });
    if (!apiKey) {
      return {
        apiKey: null,
        hasSecret: false,
        webhookUrl: null,
        lastUsedAt: null,
        totalProducts: 0,
      };
    }

    const totalProducts = await this.productRepository.count({ isActive: true });

    return {
      apiKey: this.maskApiKey(apiKey.apiKey),
      hasSecret: !!apiKey.apiSecret,
      webhookUrl: apiKey.webhookUrl,
      lastUsedAt: apiKey.lastUsedAt,
      totalProducts,
    };
  }

  @Put('config')
  async updateConfig(@Body('webhookUrl') webhookUrl: string) {
    const apiKey = await this.apiKeyRepo.findOne({ isActive: true });
    if (!apiKey) {
      throw new BadRequestException('Marketplace API key not found');
    }

    apiKey.webhookUrl = webhookUrl;
    await this.em.flush();

    return { success: true };
  }

  @Post('test-webhook')
  async testWebhook() {
    const apiKey = await this.apiKeyRepo.findOne({ isActive: true });
    if (!apiKey || !apiKey.webhookUrl || !apiKey.apiSecret) {
      throw new BadRequestException('Webhook URL not configured');
    }

    const payload = {
      event: 'test',
      message: 'This is a test webhook from Kaza Tem',
      timestamp: new Date().toISOString(),
    };

    try {
      await this.httpService.axiosRef.post(apiKey.webhookUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': this.generateSignature(payload, apiKey.apiSecret),
        },
        timeout: 5000,
      });

      return { success: true, message: 'Webhook sent successfully' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown';
      return { success: false, message };
    }
  }

  @Post('regenerate-credentials')
  async regenerateCredentials() {
    const apiKey = await this.apiKeyRepo.findOne({ isActive: true });
    if (!apiKey) {
      throw new BadRequestException('Marketplace API key not found');
    }

    const newApiKey = randomBytes(32).toString('hex');
    const newApiSecret = randomBytes(32).toString('hex');

    apiKey.apiKey = newApiKey;
    apiKey.apiSecret = newApiSecret;
    await this.em.flush();

    return {
      success: true,
      apiKey: newApiKey,
      apiSecret: newApiSecret,
      message: 'SAVE THESE CREDENTIALS - THEY WILL NOT BE SHOWN AGAIN',
    };
  }

  private maskApiKey(key: string): string {
    if (key.length <= 12) return key;
    return `${key.substring(0, 6)}...${key.substring(key.length - 6)}`;
  }

  private generateSignature(payload: any, secret: string): string {
    const data = JSON.stringify(payload);
    return createHmac('sha256', secret).update(data).digest('hex');
  }
}
