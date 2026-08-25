import { Entity, PrimaryKey, Property } from '@mikro-orm/core';

@Entity({ tableName: 'marketplace_api_keys' })
export class MarketplaceApiKeyOrmEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property()
  name!: string;

  @Property({ unique: true })
  apiKey!: string;

  @Property()
  apiSecret!: string;

  @Property({ default: true })
  isActive: boolean = true;

  @Property({ type: 'jsonb', default: ['products:read', 'products:write', 'orders:read'] })
  permissions: string[] = ['products:read', 'products:write', 'orders:read'];

  @Property({ nullable: true })
  webhookUrl?: string;

  @Property({ nullable: true })
  lastUsedAt?: Date;

  @Property({ onCreate: () => new Date() })
  createdAt: Date = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
