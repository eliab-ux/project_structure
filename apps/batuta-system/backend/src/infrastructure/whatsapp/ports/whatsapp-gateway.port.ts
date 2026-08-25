export const WHATSAPP_GATEWAY = Symbol('WHATSAPP_GATEWAY');

/** Connection state as the gateway reports it, already normalised away from Evolution's vocabulary. */
export enum GatewayConnectionState {
  OPEN = 'OPEN',
  CONNECTING = 'CONNECTING',
  CLOSED = 'CLOSED',
  /** The instance does not exist on the server (deleted, or never created). */
  MISSING = 'MISSING',
}

export interface GatewayInstanceRef {
  /** `acct-{account_id}-ch-{channel_id}` — namespaced so tenants cannot collide (§5 FASE 2 item 2). */
  instanceName: string;
  accountId: string;
}

export interface GatewayQrCode {
  /** Data URI (`data:image/png;base64,...`) ready to render. */
  base64: string;
  /** Pairing code, when the server offers one as an alternative to scanning. */
  pairingCode: string | null;
}

/**
 * What the provider says is configured for an instance right now.
 *
 * The point of reading it back is that setting a webhook can succeed and still leave it useless — the
 * `enabled` flag, the events list and the auth header are three independent ways for inbound to
 * silently never arrive, and all three look identical from the outside: no messages.
 */
export interface GatewayWebhookInfo {
  enabled: boolean;
  url: string | null;
  events: string[];
  /** Whether the auth header the webhook guard requires is configured. The VALUE is never returned. */
  hasAuthHeader: boolean;
}

export interface GatewaySendResult {
  /** Provider message id — persisted so a delivery ack can be matched back to the dispatch. */
  providerMessageId: string;
}

export interface GatewaySendTextInput {
  instance: GatewayInstanceRef;
  /** Recipient in E.164 WITHOUT the plus sign, which is what a JID carries. */
  toDigits: string;
  text: string;
}

export interface GatewaySendMediaInput extends Omit<GatewaySendTextInput, 'text'> {
  /** Base64 payload — uploads never use multipart in this system (Fastify, CLAUDE.md). */
  base64: string;
  mimeType: string;
  fileName: string;
  caption?: string;
}

/**
 * Outbound port for WhatsApp. The application never learns that Evolution exists: swapping the
 * provider means writing another adapter behind this interface.
 *
 * Every method takes a `GatewayInstanceRef` carrying the accountId, because the SERVER to talk to
 * is resolved per account (`accounts.evolution_server_url`, §14 decisão 7). No implementation may
 * read the platform env at the point of sending — always through the resolver.
 */
export interface WhatsAppGatewayPort {
  createInstance(instance: GatewayInstanceRef): Promise<void>;

  /**
   * Re-asserts the webhook configuration of an EXISTING instance, and returns whether it worked.
   *
   * It exists because the webhook is registered at creation, so an instance created while
   * `EVOLUTION_WEBHOOK_URL` was absent or wrong stays deaf forever: it sends fine, but delivery acks,
   * inbound messages and disconnections never arrive. Fixing the environment variable does not
   * retroactively fix the instance already on the server.
   *
   * The consequence of that deafness is not cosmetic — with no acks the throttle reads a 0% delivery
   * rate and drops every channel to its quota floor. So reconciliation re-asserts it rather than
   * waiting for someone to notice.
   *
   * Best-effort by contract: it returns `false` instead of throwing, because a failure to reconfigure
   * must not fail the reconciliation that carries it.
   */
  ensureWebhook(instance: GatewayInstanceRef): Promise<boolean>;

  /**
   * Reads back the instance's webhook configuration, or null when the provider has none / cannot say.
   *
   * Diagnostic only, and it exists because "no reply arrived" has at least four indistinguishable
   * causes: the webhook was never set, it was set disabled, it was set without the auth header (so the
   * guard answers 401), or it was set without `MESSAGES_UPSERT`. Reading the actual configuration turns
   * that guessing game into one screen.
   */
  findWebhook(instance: GatewayInstanceRef): Promise<GatewayWebhookInfo | null>;

  getQrCode(instance: GatewayInstanceRef): Promise<GatewayQrCode>;
  getConnectionState(instance: GatewayInstanceRef): Promise<GatewayConnectionState>;
  logout(instance: GatewayInstanceRef): Promise<void>;
  deleteInstance(instance: GatewayInstanceRef): Promise<void>;
  sendText(input: GatewaySendTextInput): Promise<GatewaySendResult>;
  sendMedia(input: GatewaySendMediaInput): Promise<GatewaySendResult>;
  sendDocument(input: GatewaySendMediaInput): Promise<GatewaySendResult>;
}
