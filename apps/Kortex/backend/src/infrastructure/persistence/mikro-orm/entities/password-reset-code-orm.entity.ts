import { Entity, Index, PrimaryKey, Property } from '@mikro-orm/core';

@Entity({ tableName: 'password_reset_code' })
@Index({ name: 'password_reset_code_account_id_index', properties: ['accountId'] })
export class PasswordResetCodeOrmEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property({ fieldName: 'account_id', type: 'uuid' })
  accountId!: string;

  @Property({ fieldName: 'user_id', type: 'uuid' })
  userId!: string;

  /** Hash bcrypt do código de 6 dígitos. O valor em claro não existe em lugar nenhum do sistema. */
  @Property({ fieldName: 'code_hash', length: 100 })
  codeHash!: string;

  @Property({ fieldName: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Property({ fieldName: 'used_at', type: 'timestamptz', nullable: true })
  usedAt: Date | null = null;

  @Property({ fieldName: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt: Date | null = null;

  @Property({ type: 'int' })
  attempts: number = 0;

  @Property({ fieldName: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
