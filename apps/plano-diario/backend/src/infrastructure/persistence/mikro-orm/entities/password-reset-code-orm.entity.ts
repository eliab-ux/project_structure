import { Entity, Index, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core';
import { UserOrmEntity } from './user-orm.entity';

@Entity({ tableName: 'password_reset_codes' })
@Index({ properties: ['userId', 'createdAt'] })
export class PasswordResetCodeOrmEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  /**
   * `mapToPk: true` mantém a propriedade como id em texto e deixa a FK sob gestão do ORM — uma
   * constraint criada só no SQL da migration seria removida pelo próximo diff.
   * Cascade no delete: código de recuperação não faz sentido sem a conta.
   */
  @ManyToOne(() => UserOrmEntity, {
    fieldName: 'user_id',
    mapToPk: true,
    updateRule: 'cascade',
    deleteRule: 'cascade',
  })
  userId!: string;

  /** Hash bcrypt do código. O valor em claro não existe em lugar nenhum do sistema. */
  @Property({ fieldName: 'code_hash', length: 255 })
  codeHash!: string;

  @Property({ fieldName: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Property({ fieldName: 'used_at', type: 'timestamptz', nullable: true })
  usedAt: Date | null = null;

  /** Quando a mensagem saiu. `null` = nunca saiu — e o que nunca saiu não gasta a cota do usuário. */
  @Property({ fieldName: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt: Date | null = null;

  @Property({ type: 'int' })
  attempts: number = 0;

  @Property({ fieldName: 'created_at', type: 'timestamptz' })
  createdAt: Date = new Date();
}
