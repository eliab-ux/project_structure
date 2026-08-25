import { PlatformAdmin } from '../../../domain/entities/platform-admin.entity';
import { PlatformAdminId } from '../../../domain/value-objects/platform-admin-id.vo';
import { Email } from '../../../../user/domain/value-objects/email.vo';

export const PLATFORM_ADMIN_REPOSITORY = Symbol('PLATFORM_ADMIN_REPOSITORY');

/** No tenant scope applies: platform admins have no account (§4). */
export interface PlatformAdminRepositoryPort {
  findById(id: PlatformAdminId): Promise<PlatformAdmin | null>;
  findByEmail(email: Email): Promise<PlatformAdmin | null>;
  save(admin: PlatformAdmin): Promise<PlatformAdmin>;
}
