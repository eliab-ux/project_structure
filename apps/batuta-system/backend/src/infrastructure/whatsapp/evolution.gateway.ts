import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError, AxiosInstance } from 'axios';
import {
  GatewayConnectionState,
  GatewayWebhookInfo,
  GatewayInstanceRef,
  GatewayQrCode,
  GatewaySendMediaInput,
  GatewaySendResult,
  GatewaySendTextInput,
  WhatsAppGatewayPort,
} from './ports/whatsapp-gateway.port';
import { EvolutionServerResolver } from './evolution-server-resolver.service';
import {
  GatewayPermanentException,
  GatewayTransientException,
} from './exceptions/gateway.exception';

const REQUEST_TIMEOUT_MS = 20_000;

/** Evolution v2 shapes, narrowed to what we actually read. */
interface EvolutionConnectRaw {
  base64?: string;
  code?: string;
  pairingCode?: string;
  instance?: { state?: string };
}

interface EvolutionStateRaw {
  instance?: { state?: string };
  state?: string;
}

interface EvolutionSendRaw {
  key?: { id?: string };
}

/**
 * Evolution API v2 adapter (§5, FASE 2 item 2).
 *
 * Two things it is careful about:
 *
 *  1. **Which server.** Every call resolves the destination through EvolutionServerResolver, so a
 *     tenant on a dedicated server is transparent to callers and no code path reads the platform
 *     env at send time.
 *  2. **Which failures are retryable.** It classifies errors into transient (network, 5xx,
 *     instance reconnecting) and permanent (invalid JID, non-existent number, 4xx), because FASE 7
 *     retries the first and must never retry the second.
 *
 * Endpoints used — Evolution v2, per the CLAUDE.md integration notes:
 *   POST /instance/create · GET /instance/connect/{name} · GET /instance/connectionState/{name}
 *   DELETE /instance/logout/{name} · DELETE /instance/delete/{name}
 *   POST /message/sendText/{name} · POST /message/sendMedia/{name}
 */
@Injectable()
export class EvolutionGateway implements WhatsAppGatewayPort {
  private readonly logger = new Logger(EvolutionGateway.name);

  constructor(
    private readonly resolver: EvolutionServerResolver,
    private readonly config: ConfigService,
  ) {}

  async createInstance(instance: GatewayInstanceRef): Promise<void> {
    const client = await this.clientFor(instance.accountId);

    await this.call(instance, 'createInstance', () =>
      client.post('/instance/create', {
        instanceName: instance.instanceName,
        integration: 'WHATSAPP-BAILEYS',
        qrcode: true,
        // The webhook is configured at creation so a freshly paired chip already reports state,
        // acks and inbound without a second call anyone could forget.
        webhook: this.webhookConfig(),
      }),
    );

    this.logger.log('Instância Evolution criada', { instance: instance.instanceName });
  }

  /**
   * `POST /webhook/set/{instance}` — reconfigura o webhook de uma instância que já existe.
   *
   * Best-effort de propósito: devolve `false` e registra o motivo em vez de lançar, porque quem chama
   * é a reconciliação de estado, e falhar ali por causa disto seria trocar um problema silencioso por
   * um erro que impede até de descobrir se o chip está conectado.
   */
  async ensureWebhook(instance: GatewayInstanceRef): Promise<boolean> {
    const webhook = this.webhookConfig();
    if (!webhook) {
      // `webhookConfig` já registrou o aviso dizendo qual variável falta.
      return false;
    }

    try {
      const client = await this.clientFor(instance.accountId);
      const path = `/webhook/set/${encodeURIComponent(instance.instanceName)}`;

      /**
       * Two body shapes, tried in order, because the Evolution v2 line changed it mid-series: newer
       * builds expect `{ webhook: {...} }` and older ones the fields at the top level. Sending the
       * wrong one is answered with a 400 and nothing else — the instance keeps whatever it had, which
       * for an instance created before `EVOLUTION_WEBHOOK_URL` existed means no webhook at all.
       *
       * Trying both is not sloppiness: there is no version endpoint that reliably tells them apart,
       * and the cost of the extra call is one 400 on the servers that need the other shape.
       */
      let response = await client.post(path, { webhook });
      if (response.status === 400 || response.status === 404) {
        this.logger.debug('Formato aninhado recusado; tentando o formato plano de /webhook/set', {
          instance: instance.instanceName,
          status: response.status,
        });
        response = await client.post(path, webhook);
      }

      const ok = response.status >= 200 && response.status < 300;
      if (!ok) {
        this.logger.warn('Evolution recusou a reconfiguração do webhook', {
          instance: instance.instanceName,
          status: response.status,
        });
      }
      return ok;
    } catch (error) {
      this.logger.warn('Falha ao reconfigurar o webhook da instância', {
        instance: instance.instanceName,
        reason: (error as Error)?.message ?? 'desconhecido',
      });
      return false;
    }
  }

  /**
   * `GET /webhook/find/{instance}` — o que está configurado de verdade, para diagnóstico.
   *
   * Best-effort como o `ensureWebhook`: devolve null em vez de lançar, porque isto é uma tela de
   * diagnóstico e falhar nela removeria justamente a informação que se foi buscar.
   */
  async findWebhook(instance: GatewayInstanceRef): Promise<GatewayWebhookInfo | null> {
    try {
      const client = await this.clientFor(instance.accountId);
      const response = await client.get(
        `/webhook/find/${encodeURIComponent(instance.instanceName)}`,
      );
      if (response.status < 200 || response.status >= 300) {
        return null;
      }

      // A resposta vem aninhada em algumas versões e plana em outras — a mesma divergência do `set`.
      const raw = (response.data ?? {}) as Record<string, unknown>;
      const body = ((raw.webhook as Record<string, unknown>) ?? raw) || {};
      const headers = (body.headers ?? {}) as Record<string, unknown>;

      return {
        enabled: body.enabled === true,
        url: typeof body.url === 'string' && body.url ? body.url : null,
        events: Array.isArray(body.events) ? body.events.map((event) => String(event)) : [],
        // Só a PRESENÇA do header. O valor é o segredo que autentica o webhook e nunca sai daqui.
        hasAuthHeader: Boolean(headers['x-batuta-webhook-token']),
      };
    } catch (error) {
      this.logger.warn('Falha ao ler a configuração de webhook da instância', {
        instance: instance.instanceName,
        reason: (error as Error)?.message ?? 'desconhecido',
      });
      return null;
    }
  }

  async getQrCode(instance: GatewayInstanceRef): Promise<GatewayQrCode> {
    const client = await this.clientFor(instance.accountId);

    const data = await this.call<EvolutionConnectRaw>(instance, 'getQrCode', () =>
      client.get(`/instance/connect/${encodeURIComponent(instance.instanceName)}`),
    );

    const base64 = data.base64 ?? data.code ?? '';
    return {
      // Evolution sometimes returns the raw base64 and sometimes a full data URI.
      base64: base64.startsWith('data:') ? base64 : base64 ? `data:image/png;base64,${base64}` : '',
      pairingCode: data.pairingCode ?? null,
    };
  }

  async getConnectionState(instance: GatewayInstanceRef): Promise<GatewayConnectionState> {
    const client = await this.clientFor(instance.accountId);

    try {
      const data = await this.call<EvolutionStateRaw>(instance, 'getConnectionState', () =>
        client.get(`/instance/connectionState/${encodeURIComponent(instance.instanceName)}`),
      );
      return EvolutionGateway.mapState(data.instance?.state ?? data.state);
    } catch (error) {
      if (error instanceof GatewayPermanentException && error.httpStatus === 404) {
        // A missing instance is a legitimate state, not an error: it is what the caller needs to
        // know in order to re-provision.
        return GatewayConnectionState.MISSING;
      }
      throw error;
    }
  }

  async logout(instance: GatewayInstanceRef): Promise<void> {
    const client = await this.clientFor(instance.accountId);
    await this.call(instance, 'logout', () =>
      client.delete(`/instance/logout/${encodeURIComponent(instance.instanceName)}`),
    );
  }

  async deleteInstance(instance: GatewayInstanceRef): Promise<void> {
    const client = await this.clientFor(instance.accountId);
    await this.call(instance, 'deleteInstance', () =>
      client.delete(`/instance/delete/${encodeURIComponent(instance.instanceName)}`),
    );
  }

  async sendText(input: GatewaySendTextInput): Promise<GatewaySendResult> {
    const client = await this.clientFor(input.instance.accountId);

    const data = await this.call<EvolutionSendRaw>(input.instance, 'sendText', () =>
      client.post(`/message/sendText/${encodeURIComponent(input.instance.instanceName)}`, {
        number: input.toDigits,
        text: input.text,
      }),
    );

    return { providerMessageId: EvolutionGateway.requireMessageId(data) };
  }

  async sendMedia(input: GatewaySendMediaInput): Promise<GatewaySendResult> {
    return this.sendMediaAs(input, EvolutionGateway.mediaTypeFor(input.mimeType));
  }

  async sendDocument(input: GatewaySendMediaInput): Promise<GatewaySendResult> {
    return this.sendMediaAs(input, 'document');
  }

  private async sendMediaAs(
    input: GatewaySendMediaInput,
    mediatype: string,
  ): Promise<GatewaySendResult> {
    const client = await this.clientFor(input.instance.accountId);

    const data = await this.call<EvolutionSendRaw>(input.instance, 'sendMedia', () =>
      client.post(`/message/sendMedia/${encodeURIComponent(input.instance.instanceName)}`, {
        number: input.toDigits,
        mediatype,
        mimetype: input.mimeType,
        // Base64 in JSON: this system never uses multipart (Fastify, CLAUDE.md).
        media: input.base64,
        fileName: input.fileName,
        caption: input.caption,
      }),
    );

    return { providerMessageId: EvolutionGateway.requireMessageId(data) };
  }

  private async clientFor(accountId: string): Promise<AxiosInstance> {
    const server = await this.resolver.resolve(accountId);
    return axios.create({
      baseURL: server.baseUrl,
      timeout: REQUEST_TIMEOUT_MS,
      // The apikey header is the instance/global credential. It is never logged.
      headers: { apikey: server.apiKey, 'Content-Type': 'application/json' },
      // We classify statuses ourselves.
      validateStatus: () => true,
    });
  }

  private webhookConfig(): Record<string, unknown> | undefined {
    const url = this.config.get<string>('EVOLUTION_WEBHOOK_URL');
    const token = this.config.get<string>('EVOLUTION_WEBHOOK_TOKEN');
    if (!url || !token) {
      this.logger.warn(
        'EVOLUTION_WEBHOOK_URL/TOKEN ausentes — a instância nascerá sem webhook e o estado de ' +
          'conexão não será atualizado automaticamente.',
      );
      return undefined;
    }
    return {
      // `enabled` is required by `POST /webhook/set` in Evolution v2, and omitting it is not a no-op:
      // the endpoint accepts the call and stores the webhook DISABLED. The instance then looks
      // configured in the manager and delivers nothing — no inbound message, no delivery ack — which
      // is indistinguishable from "no one replied" until someone compares the two.
      enabled: true,
      url,
      byEvents: false,
      base64: true,
      // Shared token in a header — the webhook guard compares it in constant time.
      headers: { 'x-batuta-webhook-token': token },
      events: ['CONNECTION_UPDATE', 'MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'SEND_MESSAGE'],
    };
  }

  /**
   * Single place where an HTTP outcome becomes a domain-shaped failure. Anything that is worth
   * retrying raises GatewayTransientException; anything that will fail identically forever raises
   * GatewayPermanentException.
   */
  private async call<T>(
    instance: GatewayInstanceRef,
    operation: string,
    request: () => Promise<{ status: number; data: unknown }>,
  ): Promise<T> {
    let response: { status: number; data: unknown };

    try {
      response = await request();
    } catch (error) {
      const axiosError = error as AxiosError;
      // No HTTP response at all: DNS, refused connection, timeout — always retryable.
      this.logger.warn('Falha de rede ao falar com a Evolution', {
        operation,
        instance: instance.instanceName,
        code: axiosError.code,
      });
      throw new GatewayTransientException(operation, axiosError.code ?? 'NETWORK_ERROR');
    }

    if (response.status >= 200 && response.status < 300) {
      return (response.data ?? {}) as T;
    }

    const detail = EvolutionGateway.describe(response.data);

    if (response.status >= 500 || response.status === 429 || response.status === 408) {
      this.logger.warn('Evolution respondeu erro transitório', {
        operation,
        instance: instance.instanceName,
        status: response.status,
      });
      throw new GatewayTransientException(operation, `HTTP_${response.status}`, response.status);
    }

    // 4xx: bad JID, unknown instance, invalid payload. Retrying repeats the same answer.
    this.logger.error('Evolution respondeu erro permanente', {
      operation,
      instance: instance.instanceName,
      status: response.status,
      detail,
    });
    throw new GatewayPermanentException(operation, detail, response.status);
  }

  private static requireMessageId(data: EvolutionSendRaw): string {
    const id = data?.key?.id;
    if (!id) {
      // Without a provider id there is no way to match a later delivery ack to this dispatch.
      throw new GatewayTransientException('sendMessage', 'MISSING_MESSAGE_ID');
    }
    return id;
  }

  private static mapState(state: string | undefined): GatewayConnectionState {
    switch ((state ?? '').toLowerCase()) {
      case 'open':
        return GatewayConnectionState.OPEN;
      case 'connecting':
        return GatewayConnectionState.CONNECTING;
      case 'close':
      case 'closed':
        return GatewayConnectionState.CLOSED;
      default:
        return GatewayConnectionState.MISSING;
    }
  }

  private static mediaTypeFor(mimeType: string): string {
    if (mimeType.startsWith('image/')) {
      return 'image';
    }
    if (mimeType.startsWith('video/')) {
      return 'video';
    }
    if (mimeType.startsWith('audio/')) {
      return 'audio';
    }
    return 'document';
  }

  /** Never returns the raw provider payload to a caller: it can echo request content. */
  private static describe(data: unknown): string {
    if (data && typeof data === 'object') {
      const record = data as Record<string, unknown>;
      const message = record.message ?? record.error ?? record.response;
      if (typeof message === 'string') {
        return message.slice(0, 200);
      }
    }
    return 'erro não detalhado pelo provedor';
  }
}
