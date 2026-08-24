import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { EntityManager, UniqueConstraintViolationException } from '@mikro-orm/core';
import { Charge } from '../../../../contexts/billing/domain/entities/charge.entity';
import {
  DunningEvent,
  DunningRule,
  DunningStep,
} from '../../../../contexts/billing/domain/entities/dunning-rule.entity';
import {
  BillingWebhookEventRepositoryPort,
  ChargeRepositoryPort,
  DunningEventRepositoryPort,
  DunningRuleRepositoryPort,
} from '../../../../contexts/billing/application/ports/output/billing-repositories.port';
import {
  BillingConfigRepositoryPort,
  BillingProviderConfig,
} from '../../../../contexts/billing/application/ports/output/billing-config-repository.port';
import {
  BillingProviderConfigOrmEntity,
  BillingWebhookEventOrmEntity,
  ChargeOrmEntity,
  DunningEventOrmEntity,
  DunningRuleOrmEntity,
} from '../entities/billing-orm.entity';

/** Repositórios do COB — filtro global + RLS escopam; nunca DELETE. */
@Injectable()
export class MikroOrmBillingConfigRepository implements BillingConfigRepositoryPort {
  constructor(private readonly em: EntityManager) {}

  private toDomain(orm: BillingProviderConfigOrmEntity): BillingProviderConfig {
    return {
      id: orm.id,
      accountId: orm.accountId,
      companyId: orm.companyId,
      provider: orm.provider as BillingProviderConfig['provider'],
      encryptedCredentials: orm.encryptedCredentials,
      agreementCode: orm.agreementCode,
      settlementAccountId: orm.settlementAccountId,
      active: orm.active,
      createdAt: orm.createdAt,
    };
  }

  async getForAccount(companyId?: string | null): Promise<BillingProviderConfig | null> {
    const rows = await this.em.find(BillingProviderConfigOrmEntity, { active: true });
    // Config da EMPRESA vence a geral (companyId null) — multi-convênio por conta/empresa (06 §2.1).
    const specific = companyId ? rows.find((row) => row.companyId === companyId) : undefined;
    const general = rows.find((row) => row.companyId === null);
    const chosen = specific ?? general ?? rows[0] ?? null;
    return chosen ? this.toDomain(chosen) : null;
  }

  async findById(id: string): Promise<BillingProviderConfig | null> {
    const orm = await this.em.findOne(BillingProviderConfigOrmEntity, { id });
    return orm ? this.toDomain(orm) : null;
  }

  async save(config: BillingProviderConfig): Promise<BillingProviderConfig> {
    const existing = await this.em.findOne(BillingProviderConfigOrmEntity, { id: config.id });
    if (existing) {
      existing.provider = config.provider;
      existing.encryptedCredentials = config.encryptedCredentials;
      existing.agreementCode = config.agreementCode;
      existing.settlementAccountId = config.settlementAccountId;
      existing.companyId = config.companyId;
      existing.active = config.active;
      existing.updatedAt = new Date();
      await this.em.flush();
      return this.toDomain(existing);
    }
    const orm = this.em.create(BillingProviderConfigOrmEntity, {
      id: config.id,
      accountId: config.accountId,
      companyId: config.companyId,
      provider: config.provider,
      encryptedCredentials: config.encryptedCredentials,
      agreementCode: config.agreementCode,
      settlementAccountId: config.settlementAccountId,
      active: config.active,
      createdAt: config.createdAt,
      updatedAt: new Date(),
      deletedAt: null,
    });
    this.em.persist(orm);
    await this.em.flush();
    return this.toDomain(orm);
  }
}

@Injectable()
export class MikroOrmChargeRepository implements ChargeRepositoryPort {
  constructor(private readonly em: EntityManager) {}

  private toDomain(orm: ChargeOrmEntity): Charge {
    return Charge.reconstitute({
      id: orm.id,
      accountId: orm.accountId,
      companyId: orm.companyId,
      titleId: orm.titleId,
      kind: orm.kind,
      status: orm.status,
      provider: orm.provider,
      providerChargeId: orm.providerChargeId,
      digitableLine: orm.digitableLine,
      pixQrCode: orm.pixQrCode,
      pdfObjectKey: orm.pdfObjectKey,
      paidAt: orm.paidAt,
      createdAt: orm.createdAt,
    });
  }

  async findById(id: string): Promise<Charge | null> {
    const orm = await this.em.findOne(ChargeOrmEntity, { id });
    return orm ? this.toDomain(orm) : null;
  }

  async findByProviderChargeId(providerChargeId: string): Promise<Charge | null> {
    const orm = await this.em.findOne(ChargeOrmEntity, { providerChargeId });
    return orm ? this.toDomain(orm) : null;
  }

  async findActiveByTitle(titleId: string): Promise<Charge | null> {
    const orm = await this.em.findOne(ChargeOrmEntity, { titleId, status: 'registered' });
    return orm ? this.toDomain(orm) : null;
  }

  async list(filter: { titleId?: string | null; status?: string | null }): Promise<Charge[]> {
    const rows = await this.em.find(
      ChargeOrmEntity,
      {
        ...(filter.titleId ? { titleId: filter.titleId } : {}),
        ...(filter.status ? { status: filter.status } : {}),
      },
      { orderBy: { createdAt: 'DESC' }, limit: 500 },
    );
    return rows.map((row) => this.toDomain(row));
  }

  async save(charge: Charge): Promise<Charge> {
    const existing = await this.em.findOne(ChargeOrmEntity, { id: charge.id });
    if (existing) {
      existing.status = charge.status;
      existing.paidAt = charge.paidAt;
      existing.updatedAt = new Date();
      await this.em.flush();
      return this.toDomain(existing);
    }
    const orm = this.em.create(ChargeOrmEntity, {
      id: charge.id,
      accountId: charge.accountId,
      companyId: charge.companyId,
      titleId: charge.titleId,
      kind: charge.kind,
      status: charge.status,
      provider: charge.provider,
      providerChargeId: charge.providerChargeId,
      digitableLine: charge.digitableLine,
      pixQrCode: charge.pixQrCode,
      pdfObjectKey: charge.pdfObjectKey || null,
      paidAt: charge.paidAt,
      createdAt: charge.createdAt,
      updatedAt: new Date(),
      deletedAt: null,
    });
    this.em.persist(orm);
    await this.em.flush();
    return this.toDomain(orm);
  }
}

@Injectable()
export class MikroOrmDunningRuleRepository implements DunningRuleRepositoryPort {
  constructor(private readonly em: EntityManager) {}

  private toDomain(orm: DunningRuleOrmEntity): DunningRule {
    const steps = (orm.steps as DunningStep[]).map((step) => ({
      ...step,
      autoEnabledAt: step.autoEnabledAt ? new Date(step.autoEnabledAt) : null,
    }));
    return DunningRule.reconstitute({
      id: orm.id,
      accountId: orm.accountId,
      steps,
      maxRebillings: orm.maxRebillings,
      active: orm.active,
      createdAt: orm.createdAt,
    });
  }

  async getForAccount(): Promise<DunningRule | null> {
    const orm = await this.em.findOne(DunningRuleOrmEntity, { active: true });
    return orm ? this.toDomain(orm) : null;
  }

  async save(rule: DunningRule): Promise<DunningRule> {
    const existing = await this.em.findOne(DunningRuleOrmEntity, { id: rule.id });
    if (existing) {
      existing.steps = rule.steps;
      existing.maxRebillings = rule.maxRebillings;
      existing.updatedAt = new Date();
      await this.em.flush();
      return this.toDomain(existing);
    }
    const orm = this.em.create(DunningRuleOrmEntity, {
      id: rule.id,
      accountId: rule.accountId,
      steps: rule.steps,
      maxRebillings: rule.maxRebillings,
      active: rule.active,
      createdAt: rule.createdAt,
      updatedAt: new Date(),
      deletedAt: null,
    });
    this.em.persist(orm);
    await this.em.flush();
    return this.toDomain(orm);
  }
}

@Injectable()
export class MikroOrmDunningEventRepository implements DunningEventRepositoryPort {
  constructor(private readonly em: EntityManager) {}

  private toDomain(orm: DunningEventOrmEntity): DunningEvent {
    return DunningEvent.reconstitute({
      id: orm.id,
      accountId: orm.accountId,
      titleId: orm.titleId,
      stepId: orm.stepId,
      offsetDays: orm.offsetDays,
      channel: orm.channel,
      renderedMessage: orm.renderedMessage,
      status: orm.status,
      sentAt: orm.sentAt,
      createdAt: orm.createdAt,
    });
  }

  async findById(id: string): Promise<DunningEvent | null> {
    const orm = await this.em.findOne(DunningEventOrmEntity, { id });
    return orm ? this.toDomain(orm) : null;
  }

  async listByTitle(titleId: string): Promise<DunningEvent[]> {
    const rows = await this.em.find(
      DunningEventOrmEntity,
      { titleId },
      { orderBy: { createdAt: 'ASC' } },
    );
    return rows.map((row) => this.toDomain(row));
  }

  async list(filter: { status?: string | null }): Promise<DunningEvent[]> {
    const rows = await this.em.find(
      DunningEventOrmEntity,
      { ...(filter.status ? { status: filter.status } : {}) },
      { orderBy: { createdAt: 'DESC' }, limit: 500 },
    );
    return rows.map((row) => this.toDomain(row));
  }

  async save(event: DunningEvent): Promise<DunningEvent> {
    const existing = await this.em.findOne(DunningEventOrmEntity, { id: event.id });
    if (existing) {
      // Append-only: a única mutação legítima é a aprovação da proposta.
      existing.status = event.status;
      existing.sentAt = event.sentAt;
      existing.updatedAt = new Date();
      await this.em.flush();
      return this.toDomain(existing);
    }
    const orm = this.em.create(DunningEventOrmEntity, {
      id: event.id,
      accountId: event.accountId,
      titleId: event.titleId,
      stepId: event.stepId,
      offsetDays: event.offsetDays,
      channel: event.channel,
      renderedMessage: event.renderedMessage,
      status: event.status,
      sentAt: event.sentAt,
      createdAt: event.createdAt,
      updatedAt: new Date(),
      deletedAt: null,
    });
    this.em.persist(orm);
    await this.em.flush();
    return this.toDomain(orm);
  }
}

@Injectable()
export class MikroOrmBillingWebhookEventRepository implements BillingWebhookEventRepositoryPort {
  constructor(private readonly em: EntityManager) {}

  async registerOnce(externalEventId: string, accountId: string): Promise<boolean> {
    try {
      const orm = this.em.create(BillingWebhookEventOrmEntity, {
        id: randomUUID(),
        accountId,
        externalEventId,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });
      this.em.persist(orm);
      await this.em.flush();
      return true;
    } catch (error) {
      if (error instanceof UniqueConstraintViolationException) {
        // Já processado — a idempotência é do BANCO (índice único), não de memória.
        return false;
      }
      throw error;
    }
  }
}
