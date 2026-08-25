import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import {
  ApprovalRequestRepositoryPort,
  ApprovalSettingsRepositoryPort,
  ApproverRepositoryPort,
  ContentAuthorProviderPort,
} from '../../../../contexts/approval/application/ports/output/approval-repositories.port';
import { ApprovalRequest } from '../../../../contexts/approval/domain/entities/approval-request.entity';
import { ApprovalSettings } from '../../../../contexts/approval/domain/entities/approval-settings.entity';
import { Approver } from '../../../../contexts/approval/domain/entities/approver.entity';
import { ApprovalRequestStatus } from '../../../../contexts/approval/domain/value-objects/approval-status.vo';
import { Email } from '../../../../contexts/user/domain/value-objects/email.vo';
import { PhoneE164 } from '../../../../shared/domain/value-objects/phone-e164.vo';
import { ApprovalRequestOrmEntity } from '../entities/approval-request-orm.entity';
import { ApprovalSettingsOrmEntity } from '../entities/approval-settings-orm.entity';
import { ApproverOrmEntity } from '../entities/approver-orm.entity';
import { UserOrmEntity } from '../entities/user-orm.entity';
import { TENANT_FILTER } from '../entities/tenant-scoped-orm.entity';

@Injectable()
export class MikroOrmApprovalSettingsRepository implements ApprovalSettingsRepositoryPort {
  constructor(private readonly em: EntityManager) {}

  async find(): Promise<ApprovalSettings | null> {
    // One row per account; the tenant filter picks the right one.
    const orm = await this.em.findOne(ApprovalSettingsOrmEntity, {});
    if (!orm) {
      return null;
    }
    return ApprovalSettings.reconstitute({
      id: orm.id,
      accountId: orm.accountId,
      requiredForInstitutional: orm.requiredForInstitutional,
      requiredForElectoral: orm.requiredForElectoral,
      notifyChannel: orm.notifyChannel,
    });
  }

  async save(settings: ApprovalSettings): Promise<ApprovalSettings> {
    await this.em.upsert(ApprovalSettingsOrmEntity, {
      id: settings.id,
      accountId: settings.accountId,
      requiredForInstitutional: settings.requiredForInstitutional,
      requiredForElectoral: settings.requiredForElectoral,
      notifyChannel: settings.notifyChannel,
      createdAt: new Date(),
    });
    await this.em.flush();
    return settings;
  }
}

@Injectable()
export class MikroOrmApproverRepository implements ApproverRepositoryPort {
  constructor(private readonly em: EntityManager) {}

  async findById(id: string): Promise<Approver | null> {
    const orm = await this.em.findOne(ApproverOrmEntity, { id });
    return orm ? MikroOrmApproverRepository.toDomain(orm) : null;
  }

  async findByEmail(email: string): Promise<Approver | null> {
    const orm = await this.em.findOne(ApproverOrmEntity, { email: email.toLowerCase() });
    return orm ? MikroOrmApproverRepository.toDomain(orm) : null;
  }

  async listAll(): Promise<Approver[]> {
    const rows = await this.em.find(ApproverOrmEntity, {}, { orderBy: { name: 'ASC' } });
    return rows.map((orm) => MikroOrmApproverRepository.toDomain(orm));
  }

  async listActive(): Promise<Approver[]> {
    const rows = await this.em.find(
      ApproverOrmEntity,
      { active: true },
      { orderBy: { name: 'ASC' } },
    );
    return rows.map((orm) => MikroOrmApproverRepository.toDomain(orm));
  }

  async save(approver: Approver): Promise<Approver> {
    await this.em.upsert(ApproverOrmEntity, {
      id: approver.id,
      accountId: approver.accountId,
      name: approver.name,
      email: approver.email?.value ?? null,
      phoneE164: approver.phone?.value ?? null,
      active: approver.active,
      createdAt: approver.createdAt,
    });
    await this.em.flush();
    return approver;
  }

  private static toDomain(orm: ApproverOrmEntity): Approver {
    return Approver.reconstitute({
      id: orm.id,
      accountId: orm.accountId,
      name: orm.name,
      email: orm.email ? Email.create(orm.email) : null,
      phone: orm.phoneE164 ? PhoneE164.create(orm.phoneE164) : null,
      active: orm.active,
      createdAt: orm.createdAt,
    });
  }
}

/**
 * Approval requests.
 *
 * One method is unscoped, and it is the magic-link lookup: the approver opening it has no account and no
 * JWT (§8 item 2), so there is no tenant to filter by. What protects it is the token — 256 bits, stored
 * only as a SHA-256, single use, short TTL — plus the rate limit on the route. Grep for
 * `[TENANT_FILTER]: false` and this is the only hit in the approval path.
 */
@Injectable()
export class MikroOrmApprovalRequestRepository implements ApprovalRequestRepositoryPort {
  constructor(private readonly em: EntityManager) {}

  async findById(id: string): Promise<ApprovalRequest | null> {
    const orm = await this.em.findOne(ApprovalRequestOrmEntity, { id });
    return orm ? MikroOrmApprovalRequestRepository.toDomain(orm) : null;
  }

  async listForContent(contentId: string): Promise<ApprovalRequest[]> {
    const rows = await this.em.find(
      ApprovalRequestOrmEntity,
      { contentId },
      { orderBy: { createdAt: 'ASC' } },
    );
    return rows.map((orm) => MikroOrmApprovalRequestRepository.toDomain(orm));
  }

  async saveMany(requests: readonly ApprovalRequest[]): Promise<void> {
    if (requests.length === 0) {
      return;
    }
    await this.em.insertMany(
      ApprovalRequestOrmEntity,
      requests.map((request) =>
        MikroOrmApprovalRequestRepository.toOrmData(request),
      ) as unknown as ApprovalRequestOrmEntity[],
    );
  }

  async save(request: ApprovalRequest): Promise<ApprovalRequest> {
    await this.em.upsert(
      ApprovalRequestOrmEntity,
      MikroOrmApprovalRequestRepository.toOrmData(request),
    );
    await this.em.flush();
    return request;
  }

  async invalidatePendingForContent(contentId: string): Promise<number> {
    return this.em.nativeUpdate(
      ApprovalRequestOrmEntity,
      { contentId, status: ApprovalRequestStatus.PENDING },
      { status: ApprovalRequestStatus.INVALIDATED },
    );
  }

  async findByTokenHashUnscoped(tokenHash: string): Promise<ApprovalRequest | null> {
    const orm = await this.em.findOne(
      ApprovalRequestOrmEntity,
      { tokenHash },
      // Unscoped by necessity — see the class docblock.
      { filters: { [TENANT_FILTER]: false } },
    );
    return orm ? MikroOrmApprovalRequestRepository.toDomain(orm) : null;
  }

  private static toDomain(orm: ApprovalRequestOrmEntity): ApprovalRequest {
    return ApprovalRequest.reconstitute({
      id: orm.id,
      accountId: orm.accountId,
      contentId: orm.contentId,
      contentHash: orm.contentHash,
      approverId: orm.approverId,
      tokenHash: orm.tokenHash,
      expiresAt: orm.expiresAt,
      status: orm.status,
      decidedAt: orm.decidedAt,
      decidedIp: orm.decidedIp,
      decidedUserAgent: orm.decidedUserAgent,
      comment: orm.comment,
      createdAt: orm.createdAt,
    });
  }

  private static toOrmData(request: ApprovalRequest): Record<string, unknown> {
    return {
      id: request.id,
      accountId: request.accountId,
      contentId: request.contentId,
      contentHash: request.contentHash,
      approverId: request.approverId,
      tokenHash: request.tokenHashForPersistence(),
      expiresAt: request.expiresAt,
      status: request.status,
      decidedAt: request.decidedAt,
      decidedIp: request.decidedIp,
      decidedUserAgent: request.decidedUserAgent,
      comment: request.comment,
      createdAt: request.createdAt,
    };
  }
}

/**
 * Resolves the author's e-mail for the "approver ≠ author" check (§8.5).
 *
 * Unscoped read of `users`, and the reason is subtle: this runs while an approval request is being
 * decided from a magic link, where there is no tenant scope in force. The id comes from
 * `contents.created_by` — a value the system wrote — so it cannot be pointed at another tenant's user by
 * a caller.
 */
@Injectable()
export class MikroOrmContentAuthorProvider implements ContentAuthorProviderPort {
  constructor(private readonly em: EntityManager) {}

  async emailOf(userId: string): Promise<string | null> {
    const user = await this.em.findOne(
      UserOrmEntity,
      { id: userId },
      { filters: { [TENANT_FILTER]: false }, fields: ['email'] },
    );
    return user?.email ?? null;
  }
}
