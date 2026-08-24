export const CREDENTIALS_CIPHER = Symbol('CREDENTIALS_CIPHER');

/**
 * Cifra as credenciais do provedor em repouso (aes-256-gcm, chave em `BILLING_CREDENTIALS_KEY`).
 * O valor em claro existe só no trânsito set-config → cifra e no adapter do provedor na hora de
 * chamar a API — nunca em banco, log ou resposta HTTP.
 */
export interface CredentialsCipherPort {
  encrypt(plaintext: string): string;
  decrypt(ciphertext: string): string;
}

export const BILLING_PAYER_LOOKUP = Symbol('BILLING_PAYER_LOOKUP');

/** O que o boleto precisa do pagador — lido do contato sem o billing depender do módulo inteiro. */
export interface BillingPayerInfo {
  name: string;
  document: string | null;
  email: string | null;
  whatsapp: string | null;
}

export interface BillingPayerLookupPort {
  findByContactId(contactId: string): Promise<BillingPayerInfo | null>;
}

export const BILLING_PDF_STORAGE = Symbol('BILLING_PDF_STORAGE');

/** PDF do boleto → storage; a CHAVE persiste na charge (URL nunca — mesma regra das evidências). */
export interface BillingPdfStoragePort {
  store(params: { accountId: string; chargeId: string; pdfBase64: string }): Promise<string>;
}

export const DUNNING_MESSENGER = Symbol('DUNNING_MESSENGER');

/**
 * O envio da régua (06 §2.3) — consome a engine de notificação da casa: WhatsApp pela instância de
 * SISTEMA do Evolution (a mesma do reset de senha — chip de campanha cai, canal de régua não pode
 * cair com ele). Canal não configurado RECUSA claro, nunca finge que enviou.
 */
export interface DunningMessengerPort {
  send(params: {
    channel: 'whatsapp' | 'email';
    to: string;
    message: string;
  }): Promise<void>;
}
