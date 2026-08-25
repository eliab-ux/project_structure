import { Entity, PrimaryKey, Property, Unique } from '@mikro-orm/core';

@Entity({ tableName: 'instagram_connection' })
export class InstagramConnectionOrmEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  // One connection per tenant.
  @Property({ fieldName: 'owner_id', type: 'uuid' })
  @Unique()
  ownerId!: string;

  // Unique GLOBAL: a single Instagram account can be connected by only one tenant.
  @Property({ fieldName: 'ig_user_id', length: 64 })
  @Unique()
  igUserId!: string;

  @Property({ length: 255 })
  username!: string;

  // AES-256-GCM ciphertext (iv:authTag:data). Never stored or logged in plaintext.
  @Property({ fieldName: 'access_token_encrypted', type: 'text' })
  accessTokenEncrypted!: string;

  @Property({ fieldName: 'token_expires_at', nullable: true })
  tokenExpiresAt?: Date | null;

  @Property({ length: 20 })
  status: string = 'connected';

  @Property({ fieldName: 'connected_at' })
  connectedAt: Date = new Date();
}
