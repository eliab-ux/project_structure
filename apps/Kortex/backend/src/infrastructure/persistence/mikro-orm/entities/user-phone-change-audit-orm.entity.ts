import { Entity, Index, PrimaryKey, Property } from '@mikro-orm/core';

@Entity({ tableName: 'user_phone_change_audit' })
@Index({ name: 'user_phone_change_audit_account_id_index', properties: ['accountId'] })
export class UserPhoneChangeAuditOrmEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property({ fieldName: 'account_id', type: 'uuid' })
  accountId!: string;

  /** Quem teve o telefone alterado. */
  @Property({ fieldName: 'user_id', type: 'uuid' })
  userId!: string;

  /** Quem alterou. Sempre um `owner` — é o único papel que pode (spec §6.12). */
  @Property({ fieldName: 'changed_by_user_id', type: 'uuid' })
  changedByUserId!: string;

  @Property({ fieldName: 'previous_phone', length: 20 })
  previousPhone!: string;

  @Property({ fieldName: 'new_phone', length: 20 })
  newPhone!: string;

  @Property({ fieldName: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
