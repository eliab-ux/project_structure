import { Charge } from '../../../domain/entities/charge.entity';
import { DunningEvent, DunningRule } from '../../../domain/entities/dunning-rule.entity';

export const CHARGE_REPOSITORY = Symbol('CHARGE_REPOSITORY');

export interface ChargeRepositoryPort {
  findById(id: string): Promise<Charge | null>;
  findByProviderChargeId(providerChargeId: string): Promise<Charge | null>;
  /** A charge ATIVA (registered) de um título — só uma por vez. */
  findActiveByTitle(titleId: string): Promise<Charge | null>;
  list(filter: { titleId?: string | null; status?: string | null }): Promise<Charge[]>;
  save(charge: Charge): Promise<Charge>;
}

export const DUNNING_RULE_REPOSITORY = Symbol('DUNNING_RULE_REPOSITORY');

export interface DunningRuleRepositoryPort {
  /** A régua da conta (uma no V1) — o tenant escopa; `null` = ainda não configurada. */
  getForAccount(): Promise<DunningRule | null>;
  save(rule: DunningRule): Promise<DunningRule>;
}

export const DUNNING_EVENT_REPOSITORY = Symbol('DUNNING_EVENT_REPOSITORY');

export interface DunningEventRepositoryPort {
  findById(id: string): Promise<DunningEvent | null>;
  listByTitle(titleId: string): Promise<DunningEvent[]>;
  list(filter: { status?: string | null }): Promise<DunningEvent[]>;
  /** Append-only: `save` insere ou atualiza SÓ status/sentAt (aprovação da proposta). */
  save(event: DunningEvent): Promise<DunningEvent>;
}

export const BILLING_WEBHOOK_EVENT_REPOSITORY = Symbol('BILLING_WEBHOOK_EVENT_REPOSITORY');

/** Idempotência do webhook (06 aceite 3): o id externo processado UMA vez, para sempre. */
export interface BillingWebhookEventRepositoryPort {
  /** `true` = registrou agora (primeira vez); `false` = já processado — o chamador não repete. */
  registerOnce(externalEventId: string, accountId: string): Promise<boolean>;
}
