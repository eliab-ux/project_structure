import { Entity, Index, Property, Unique } from '@mikro-orm/core';
import { TenantScopedOrmEntity } from './tenant-scoped-orm.entity';

/** Config do provedor de cobrança (06 §3) — credenciais SEMPRE cifradas (aes-256-gcm). */
@Entity({ tableName: 'billing_provider_configs' })
export class BillingProviderConfigOrmEntity extends TenantScopedOrmEntity {
  @Property({ type: 'uuid', nullable: true, fieldName: 'company_id' })
  companyId!: string | null;

  @Property({ length: 30 })
  provider!: string;

  @Property({ type: 'text', fieldName: 'encrypted_credentials' })
  encryptedCredentials!: string;

  @Property({ length: 60, nullable: true, fieldName: 'agreement_code' })
  agreementCode!: string | null;

  @Property({ type: 'uuid', fieldName: 'settlement_account_id' })
  settlementAccountId!: string;

  @Property()
  active!: boolean;
}

/** Instrumento emitido (06 §3) — o boleto/Pix de um título. */
@Entity({ tableName: 'charges' })
@Index({ properties: ['titleId'] })
export class ChargeOrmEntity extends TenantScopedOrmEntity {
  @Property({ type: 'uuid', fieldName: 'company_id' })
  companyId!: string;

  @Property({ type: 'uuid', fieldName: 'title_id' })
  titleId!: string;

  @Property({ length: 10 })
  kind!: string;

  @Property({ length: 20 })
  status!: string;

  @Property({ length: 30 })
  provider!: string;

  @Property({ length: 120, nullable: true, fieldName: 'provider_charge_id' })
  providerChargeId!: string | null;

  @Property({ length: 80, nullable: true, fieldName: 'digitable_line' })
  digitableLine!: string | null;

  @Property({ type: 'text', nullable: true, fieldName: 'pix_qr_code' })
  pixQrCode!: string | null;

  @Property({ length: 300, nullable: true, fieldName: 'pdf_object_key' })
  pdfObjectKey!: string | null;

  @Property({ type: 'timestamptz', nullable: true, fieldName: 'paid_at' })
  paidAt!: Date | null;
}

/** Régua da conta — as etapas moram em jsonb (conjunto pequeno, lido sempre inteiro). */
@Entity({ tableName: 'dunning_rules' })
export class DunningRuleOrmEntity extends TenantScopedOrmEntity {
  @Property({ type: 'json' })
  steps!: unknown;

  @Property({ fieldName: 'max_rebillings' })
  maxRebillings!: number;

  @Property()
  active!: boolean;
}

/** Histórico da régua — APPEND-ONLY (06 aceite 6): grant sem UPDATE além de status/sent_at. */
@Entity({ tableName: 'dunning_events' })
@Index({ properties: ['titleId'] })
export class DunningEventOrmEntity extends TenantScopedOrmEntity {
  @Property({ type: 'uuid', fieldName: 'title_id' })
  titleId!: string;

  @Property({ type: 'uuid', fieldName: 'step_id' })
  stepId!: string;

  @Property({ fieldName: 'offset_days' })
  offsetDays!: number;

  @Property({ length: 20 })
  channel!: string;

  @Property({ type: 'text', fieldName: 'rendered_message' })
  renderedMessage!: string;

  @Property({ length: 20 })
  status!: string;

  @Property({ type: 'timestamptz', nullable: true, fieldName: 'sent_at' })
  sentAt!: Date | null;
}

/** Idempotência do webhook (06 aceite 3): id externo processado UMA vez, único por conta. */
@Entity({ tableName: 'billing_webhook_events' })
@Unique({ properties: ['accountId', 'externalEventId'] })
export class BillingWebhookEventOrmEntity extends TenantScopedOrmEntity {
  @Property({ length: 160, fieldName: 'external_event_id' })
  externalEventId!: string;
}
