import { Entity, Index, Property, Unique } from '@mikro-orm/core';
import { TenantScopedOrmEntity } from './tenant-scoped-orm.entity';

@Entity({ tableName: 'roles' })
@Unique({ properties: ['accountId', 'code'] })
export class RoleOrmEntity extends TenantScopedOrmEntity {
  @Index()
  @Property({ length: 30 })
  code!: string;

  @Property({ length: 60 })
  name!: string;

  @Property({ length: 300, nullable: true })
  description: string | null = null;

  /**
   * Granted permission strings, including wildcards. jsonb because the set is read and written as a
   * whole and validated against the code-side catalogue by `PermissionSet` — the database is
   * storage here, not the authority on what a permission is.
   */
  @Property({ type: 'json' })
  permissions: string[] = [];

  /** One of the seven seeded roles: renamable and adjustable, but never deletable. */
  @Property({ type: 'boolean', fieldName: 'is_system' })
  isSystem: boolean = false;
}
