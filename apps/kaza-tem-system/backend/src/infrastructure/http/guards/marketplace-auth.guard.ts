import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityManager, EntityRepository } from '@mikro-orm/core';
import { MarketplaceApiKeyOrmEntity } from '@infrastructure/persistence/mikro-orm/entities/marketplace-api-key-orm.entity';

@Injectable()
export class MarketplaceAuthGuard implements CanActivate {
  constructor(
    @InjectRepository(MarketplaceApiKeyOrmEntity)
    private readonly apiKeyRepo: EntityRepository<MarketplaceApiKeyOrmEntity>,
    private readonly em: EntityManager,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];
    const apiSecret = request.headers['x-api-secret'];

    if (!apiKey || !apiSecret) {
      throw new UnauthorizedException('API credentials required');
    }

    const credentials = await this.apiKeyRepo.findOne({ apiKey });

    if (!credentials) {
      throw new UnauthorizedException('Invalid API key');
    }

    if (!credentials.isActive) {
      throw new UnauthorizedException('API key disabled');
    }

    if (credentials.apiSecret !== apiSecret) {
      throw new UnauthorizedException('Invalid API secret');
    }

    credentials.lastUsedAt = new Date();
    this.em.flush().catch(() => {});

    request.marketplaceCredentials = credentials;

    return true;
  }
}
