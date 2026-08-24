export const BILLING_PROVIDER = Symbol('BILLING_PROVIDER');

/** O que o agregador precisa para registrar uma cobrança — independente de qual agregador. */
export interface RegisterChargeRequest {
  kind: 'boleto' | 'pix';
  amount: number;
  dueDate: Date;
  description: string;
  payer: {
    name: string;
    document: string | null;
    email: string | null;
  };
  /** Convênio/credencial da config da conta — o adapter resolve o que o provedor exigir. */
  configId: string;
}

export interface RegisterChargeResult {
  providerChargeId: string;
  digitableLine: string | null;
  pixQrCode: string | null;
  /** PDF do boleto quando o provedor devolve — vai ao storage; a CHAVE persiste na charge. */
  pdfBase64: string | null;
}

/** Evento de webhook NORMALIZADO — cada adapter traduz o formato do seu provedor para este. */
export interface BillingWebhookEvent {
  /** Id do EVENTO no provedor — a chave da idempotência (processar duas vezes = uma baixa). */
  externalEventId: string;
  providerChargeId: string;
  type: 'paid' | 'cancelled';
  paidAmount: number | null;
  paidAt: Date | null;
  /** Tarifa do evento (06 §2.2) — vira lançamento com categoria própria. */
  fee: number | null;
}

/**
 * A FRONTEIRA do agregador de cobrança (06 §2.1) — Kobana/TecnoSpeed/Asaas atrás do MESMO port;
 * a escolha final é troca de adapter, não refatoração. Sem credencial configurada, o adapter
 * default RECUSA LOUD (`BillingProviderNotConfiguredException`) — regra da casa: adapter de teste
 * nunca é fallback de produção, e emitir boleto de mentira seria pior que recusar.
 */
export interface BillingProviderPort {
  registerCharge(request: RegisterChargeRequest): Promise<RegisterChargeResult>;
  cancelCharge(configId: string, providerChargeId: string): Promise<void>;
  /** O botão Testar da config: valida credencial/conexão sem emitir nada. */
  testConnection(configId: string): Promise<{ ok: boolean; message: string }>;
  /** Traduz o payload cru do webhook para o evento normalizado; assinatura inválida = null. */
  parseWebhook(rawBody: string, headers: Record<string, string>): Promise<BillingWebhookEvent | null>;
}
