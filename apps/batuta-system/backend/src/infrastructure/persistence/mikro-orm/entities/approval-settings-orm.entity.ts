import { Entity, Enum, Property, Unique } from '@mikro-orm/core';
import { NotifyChannel } from '../../../../contexts/approval/domain/value-objects/notify-channel.vo';
import { TenantScopedOrmEntity } from './tenant-scoped-orm.entity';

/** One row per account (8 item 1). */
@Entity({ tableName: 'approval_settings' })
@Unique({ properties: ['accountId'] })
export class ApprovalSettingsOrmEntity extends TenantScopedOrmEntity {
  /** 1 or 2, enforced by the domain and by a CHECK constraint. */
  @Property({ type: 'int', fieldName: 'required_for_institutional' })
  requiredForInstitutional!: number;

  /** Configurable SEPARATELY from institutional: electoral content carries its own exposure. */
  @Property({ type: 'int', fieldName: 'required_for_electoral' })
  requiredForElectoral!: number;

  @Enum({ items: () => NotifyChannel, fieldName: 'notify_channel' })
  notifyChannel!: NotifyChannel;
}
