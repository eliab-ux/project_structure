export const BILLING_CONFIG_REPOSITORY = Symbol('BILLING_CONFIG_REPOSITORY');

/**
 * A configuração do provedor por conta/empresa (06 §3): provedor escolhido, credenciais CIFRADAS
 * (aes-256-gcm com chave do ambiente — o valor em claro nunca toca o banco nem os logs), convênio
 * e a CONTA FINANCEIRA onde a baixa do webhook entra.
 */
export interface BillingProviderConfig {
  id: string;
  accountId: string;
  companyId: string | null;
  provider: 'kobana' | 'tecnospeed' | 'asaas';
  /** Ciphertext (nunca o valor). A leitura para uso é do adapter do provedor, nunca da tela. */
  encryptedCredentials: string;
  agreementCode: string | null;
  /** Conta financeira da liquidação — onde a baixa automática entra (06 §2.2). */
  settlementAccountId: string;
  active: boolean;
  createdAt: Date;
}

export interface BillingConfigRepositoryPort {
  getForAccount(companyId?: string | null): Promise<BillingProviderConfig | null>;
  findById(id: string): Promise<BillingProviderConfig | null>;
  save(config: BillingProviderConfig): Promise<BillingProviderConfig>;
}
