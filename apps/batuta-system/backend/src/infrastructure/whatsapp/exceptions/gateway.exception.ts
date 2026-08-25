import { DomainException } from '@gitspread/domain-primitives';

/**
 * Worth retrying: network error, 5xx, 429, instance reconnecting. FASE 7 retries these with
 * exponential backoff.
 */
export class GatewayTransientException extends DomainException {
  constructor(
    public readonly operation: string,
    public readonly cause: string,
    public readonly httpStatus?: number,
  ) {
    // The client-facing message says nothing about the provider or the internal cause.
    super('Falha temporária ao falar com o WhatsApp. Tentaremos novamente.');
  }
}

/**
 * Will fail identically forever: invalid JID, non-existent number, unknown instance, bad payload.
 * FASE 7 marks the dispatch FAILED immediately and does NOT retry.
 */
export class GatewayPermanentException extends DomainException {
  constructor(
    public readonly operation: string,
    public readonly detail: string,
    public readonly httpStatus?: number,
  ) {
    super('O WhatsApp recusou esta operação.');
  }
}
