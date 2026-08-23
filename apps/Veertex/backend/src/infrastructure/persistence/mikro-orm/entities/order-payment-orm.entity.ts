import { Entity, Index, Property } from '@mikro-orm/core';
import { TenantScopedOrmEntity } from './tenant-scoped-orm.entity';

/**
 * `order_payments` (§4.1 do 02A) — pagamentos do pedido, N por pedido (pagamento misto). Tabela de
 * TENANT com RLS. **Dormente**: o schema nasce pronto (IN 1608/25-GO exige o vínculo pagamento↔NFC-e),
 * mas nenhum fluxo grava aqui até o PDV/TEF. O bloco `tef_*` fica nulo até lá.
 */
@Entity({ tableName: 'order_payments' })
export class OrderPaymentOrmEntity extends TenantScopedOrmEntity {
  @Index()
  @Property({ type: 'uuid', fieldName: 'order_id' })
  orderId!: string;

  @Property({ length: 20 })
  method!: string;

  @Property({ type: 'uuid', nullable: true, fieldName: 'payment_condition_id' })
  paymentConditionId: string | null = null;

  @Property({ type: 'numeric', precision: 14, scale: 2 })
  amount!: string;

  @Property({ type: 'int' })
  installments = 1;

  // ── Bloco TEF-ready (dormente) ──────────────────────────────────────────────────────────────
  @Property({ length: 60, nullable: true, fieldName: 'tef_provider' })
  tefProvider: string | null = null;

  @Property({ length: 60, nullable: true, fieldName: 'tef_nsu' })
  tefNsu: string | null = null;

  @Property({ length: 60, nullable: true, fieldName: 'tef_authorization' })
  tefAuthorization: string | null = null;

  @Property({ length: 40, nullable: true, fieldName: 'tef_brand' })
  tefBrand: string | null = null;

  @Property({ length: 40, nullable: true, fieldName: 'tef_status' })
  tefStatus: string | null = null;

  @Property({ type: 'text', nullable: true, fieldName: 'tef_payload' })
  tefPayload: string | null = null;

  @Property({ length: 14, nullable: true, fieldName: 'acquirer_cnpj' })
  acquirerCnpj: string | null = null;
}
