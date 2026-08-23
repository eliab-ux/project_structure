import { Entity, Enum, Index, PrimaryKey, Property } from '@mikro-orm/core';
import { AccountStatus } from '../../../../contexts/account/domain/value-objects/account-status.vo';

/**
 * `accounts` IS the tenant, so it does not extend TenantScopedOrmEntity and carries no
 * `account_id` — its own `id` is the tenant.
 *
 * Consequently it is NOT covered by the global tenant filter, and its RLS policy compares `id`
 * (not `account_id`) against `app.account_id`: an authenticated request reads its own account row
 * and no other. Every read must come from a use case that either uses the JWT's accountId or runs
 * under the operator scope.
 *
 * No `deleted_at`: an account is never soft-deleted, it moves to `CANCELLED` after the export
 * window (Visão Geral §2.5). A soft delete would hide the row from the very reports the customer
 * asked to download.
 */
@Entity({ tableName: 'accounts' })
export class AccountOrmEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property({ length: 200 })
  name!: string;

  /** CPF/CNPJ digits only — the VO strips punctuation so the unique index can see duplicates. */
  @Index()
  @Property({ length: 14, unique: true })
  document!: string;

  @Index()
  @Property({ type: 'uuid', fieldName: 'plan_id' })
  planId!: string;

  @Index()
  @Enum({ items: () => AccountStatus })
  status!: AccountStatus;

  @Property({ length: 64 })
  timezone: string = 'America/Sao_Paulo';

  @Property({ type: 'timestamptz', nullable: true, fieldName: 'suspended_at' })
  suspendedAt: Date | null = null;

  /** Internal operator note. Never mapped into a response DTO. */
  @Property({ length: 500, nullable: true, fieldName: 'suspension_reason' })
  suspensionReason: string | null = null;

  /** Step one of cancellation: the export window opened. The account still works. */
  @Property({ type: 'timestamptz', nullable: true, fieldName: 'cancellation_requested_at' })
  cancellationRequestedAt: Date | null = null;

  @Property({ type: 'timestamptz', nullable: true, fieldName: 'cancelled_at' })
  cancelledAt: Date | null = null;

  // ── Preferências da conta (§1 do 01A) — colunas nomeadas, com default declarado ──────────────
  // Default no DB E no VO de domínio: a coluna nasce com o valor conservador, e uma leitura que
  // encontrasse nulo (não deveria, com NOT NULL DEFAULT) ainda cairia no default do VO.
  @Property({ fieldName: 'allow_duplicate_document' })
  allowDuplicateDocument: boolean = false;

  @Property({ length: 20, fieldName: 'contact_code_mode' })
  contactCodeMode: string = 'manual';

  @Property({ length: 20, fieldName: 'product_sku_mode' })
  productSkuMode: string = 'manual';

  /** Carteirização (§2.3 do 02): visibilidade de contato por vendedor. Ver ADR-0007. */
  @Property({ fieldName: 'contact_carteirizacao' })
  contactCarteirizacao: boolean = false;

  /** Estoque negativo permitido (§3.2 do 03). Default bloquear. */
  @Property({ fieldName: 'stock_allow_negative' })
  stockAllowNegative: boolean = false;

  /** Juros ao mês (%) por atraso — parâmetro da conta (§2.1 do 05). Default 0. */
  @Property({ type: 'numeric', precision: 6, scale: 2, fieldName: 'fin_monthly_interest_percent' })
  finMonthlyInterestPercent = '0';

  /** Multa (%) por atraso — parâmetro da conta (§2.1 do 05). Default 0. */
  @Property({ type: 'numeric', precision: 6, scale: 2, fieldName: 'fin_fine_percent' })
  finFinePercent = '0';

  /** Limiar de RECOBRANÇAS antes da "perdida" (§3.4 do 04 — "1+3", o 3 configurável). */
  @Property({ type: 'int', fieldName: 'rot_recollection_limit' })
  rotRecollectionLimit = 3;

  @Property({ type: 'timestamptz', fieldName: 'created_at' })
  createdAt: Date = new Date();

  @Property({ type: 'timestamptz', fieldName: 'updated_at' })
  updatedAt: Date = new Date();
}
