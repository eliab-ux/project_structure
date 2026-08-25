import { Injectable, Logger } from '@nestjs/common';
import { ApplyConnectionUpdateUseCase } from '../../../../contexts/channel/application/use-cases/apply-connection-update/apply-connection-update.use-case';
import { ApplyConnectionUpdateCommand } from '../../../../contexts/channel/application/use-cases/apply-connection-update/apply-connection-update.command';
import { ChannelId } from '../../../../contexts/channel/domain/value-objects/channel-id.vo';
import { GatewayConnectionState } from '../../../whatsapp/ports/whatsapp-gateway.port';
import { parseInstanceName } from '../../../whatsapp/instance-name';
import { IngestInboundMessageUseCase } from '../../../../contexts/inbox/application/use-cases/ingest-inbound-message/ingest-inbound-message.use-case';
import { IngestInboundMessageCommand } from '../../../../contexts/inbox/application/use-cases/ingest-inbound-message/ingest-inbound-message.command';
import { MessageKind } from '../../../../contexts/inbox/domain/value-objects/message-kind.vo';
import { RecordDeliveryAckUseCase } from '../../../../contexts/dispatch/application/use-cases/record-delivery-ack/record-delivery-ack.use-case';
import { RecordDeliveryAckCommand } from '../../../../contexts/dispatch/application/use-cases/record-delivery-ack/record-delivery-ack.command';
import { TenantScopedJobRunner } from '../../../messaging/tenant-scoped-job.runner';
import { EvolutionWebhookRequestDto } from './dto/evolution-webhook-request.dto';

/** Event names, normalised: Evolution sends `connection.update` or `CONNECTION_UPDATE`. */
function normalizeEvent(event: string): string {
  return (event ?? '').toLowerCase().replace(/_/g, '.');
}

/**
 * Routes one webhook call to the right use case (§5, FASE 2 item 4).
 *
 * The tenant is established from the INSTANCE NAME, which we generated and which embeds the account
 * — never from the payload body. Combined with the shared token, that means a leaked token still
 * cannot be aimed at another tenant's channel.
 *
 * Events and their status in this phase:
 *  - `connection.update` → handled: updates `channels.status`;
 *  - `messages.update` / `send.message` (delivery and read acks) → written to
 *    `dispatches.delivery_status`. This is what feeds `delivery_rate`, the main signal of the adaptive
 *    throttle (§2.1) — if these stopped being recorded, every channel would read as 0% delivered and
 *    every quota would fall to the floor;
 *  - `messages.upsert` (inbound) → handed to the inbox (FASE 8), which creates or reopens the ONE
 *    conversation of that contact, stores the message and its media, classifies it, and lets opt-out and
 *    acknowledgement close themselves. The §6.5 automation remains the only implementation of an
 *    opt-out — the inbox calls it rather than repeating it.
 *
 * **The webhook never promotes a channel to BANNED or RETIRED**, whatever the provider reports. That
 * rule is enforced inside ApplyConnectionUpdateUseCase, not here, so it holds for every caller.
 */
@Injectable()
export class EvolutionWebhookService {
  private readonly logger = new Logger(EvolutionWebhookService.name);

  constructor(
    private readonly applyConnectionUpdate: ApplyConnectionUpdateUseCase,
    private readonly recordDeliveryAck: RecordDeliveryAckUseCase,
    private readonly ingestInbound: IngestInboundMessageUseCase,
    private readonly runner: TenantScopedJobRunner,
  ) {}

  async handle(payload: EvolutionWebhookRequestDto): Promise<void> {
    const parsed = parseInstanceName(payload.instance);

    // One line per call, at LOG level, before any branch.
    //
    // This exists because of a real dead end: three POSTs arrived and only ONE left a trace, so there
    // was no way to tell what the other two even were. The silent paths were a successful delivery ack
    // and a successful connection update — both legitimately quiet, and together they made "the reply
    // never arrived" indistinguishable from "the reply arrived and something ate it". Every webhook call
    // now says what it was, so that question is answered by looking instead of by deduction.
    //
    // `debug` would not do: it is the level a production log filter drops first, and this is the line
    // you need precisely when something is wrong.
    //
    // Interpolado na própria mensagem, e NÃO como objeto de contexto:
    // `logger.log('msg', { ... })` faz o Nest imprimir a mensagem e depois uma linha `Object:` — e o
    // conteúdo dela não sobreviveu até o log do Dokploy: chegou vazia. Ou seja, a linha existia e o dado
    // que importa (o evento e o `fromMe`) era exatamente o que se perdia. Uma string única não tem como
    // se perder pelo caminho, e é isso que se pede de uma linha de diagnóstico.
    this.logger.log(
      `Webhook recebido — event=${payload.event ?? '(vazio)'} ` +
        `instanciaReconhecida=${parsed !== null} ` +
        `fromMe=${EvolutionWebhookService.readFromMe(payload) ?? '(ausente)'} ` +
        `de=${EvolutionWebhookService.maskedRemote(payload) ?? '(ausente)'}`,
    );

    if (!parsed) {
      // Another system may legitimately share this Evolution server. An unrecognised instance is
      // ignored, never guessed at.
      this.logger.warn(`Webhook de instância não reconhecida — instance=${payload.instance}`);
      return;
    }

    const event = normalizeEvent(payload.event);

    switch (event) {
      case 'connection.update':
        await this.handleConnectionUpdate(parsed.accountId, parsed.channelId, payload);
        return;

      case 'messages.update':
      case 'send.message':
        await this.handleDeliveryAck(parsed.accountId, payload);
        return;

      case 'messages.upsert':
        await this.handleInbound(parsed.accountId, parsed.channelId, payload);
        return;

      default:
        this.logger.log(`Evento de webhook não tratado — event=${event}`);
    }
  }

  /**
   * Delivery / read ack (§2.1, `delivery_rate`).
   *
   * Matched by the provider's message id, which the send persisted. An ack that matches nothing is
   * ignored: on a shared Evolution server this endpoint legitimately receives acks for messages this
   * system never sent, and it must not treat that as an error.
   */
  private async handleDeliveryAck(
    accountId: string,
    payload: EvolutionWebhookRequestDto,
  ): Promise<void> {
    const data = EvolutionWebhookService.dataOf(payload) as {
      keyId?: unknown;
      key?: { id?: unknown };
      status?: unknown;
      update?: { status?: unknown };
    };
    const providerMessageId =
      typeof data.key?.id === 'string'
        ? data.key.id
        : typeof data.keyId === 'string'
          ? data.keyId
          : null;
    const rawStatus =
      typeof data.status === 'string'
        ? data.status
        : typeof data.update?.status === 'string'
          ? data.update.status
          : null;

    if (!providerMessageId || !rawStatus) {
      this.logger.log('Ack ignorado — sem id de mensagem ou sem status');
      return;
    }

    await this.runner.run(accountId, async () => {
      const matched = await this.recordDeliveryAck.execute(
        new RecordDeliveryAckCommand(accountId, providerMessageId, rawStatus.toUpperCase()),
      );
      // Logged either way. A matched ack used to be the quietest thing in the system, and silence on the
      // path that feeds `delivery_rate` is what let "0% entregue" look like a mystery for so long.
      this.logger.log(
        `Ack de entrega processado — status=${rawStatus.toUpperCase()} casou=${matched}`,
      );
    });
  }

  private async handleConnectionUpdate(
    accountId: string,
    channelId: string,
    payload: EvolutionWebhookRequestDto,
  ): Promise<void> {
    const data = EvolutionWebhookService.dataOf(payload);
    const rawState = typeof data.state === 'string' ? data.state : undefined;
    const statusReason =
      typeof data.statusReason === 'number' || typeof data.statusReason === 'string'
        ? String(data.statusReason)
        : null;

    const state = EvolutionWebhookService.mapState(rawState);
    if (!state) {
      this.logger.warn(`connection.update sem estado reconhecível — rawState=${rawState}`);
      return;
    }

    // Same tenant-scoping machinery the workers use: forked EntityManager, scope from a value we
    // control. The webhook has no JWT, so this is what satisfies the global tenant filter.
    await this.runner.run(accountId, async () => {
      await this.applyConnectionUpdate.execute(
        new ApplyConnectionUpdateCommand(
          accountId,
          ChannelId.from(channelId),
          payload.instance,
          state,
          statusReason,
        ),
      );
      this.logger.log(`Estado de conexão aplicado — state=${state}`);
    });
  }

  /**
   * The event payload, normalised to ONE object.
   *
   * Evolution sends `data` as an object in most versions and as a single-element ARRAY in others — the
   * same drift that changed the body of `/webhook/set` mid-v2. Unwrapping here means the rest of the
   * service never has to know, and a future variant costs one line in one place.
   *
   * Anything that is not usable returns `{}`, so every accessor downstream keeps reading a plain object
   * and none of them can throw on a shape we did not expect.
   */
  private static dataOf(payload: EvolutionWebhookRequestDto): Record<string, unknown> {
    const data: unknown = payload.data;
    if (Array.isArray(data)) {
      const first: unknown = data[0];
      return first && typeof first === 'object' ? (first as Record<string, unknown>) : {};
    }
    return data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  }

  /** `fromMe` when the payload carries it — reported so an echo is visible without inference. */
  private static readFromMe(payload: EvolutionWebhookRequestDto): boolean | null {
    const key = (EvolutionWebhookService.dataOf(payload) as { key?: { fromMe?: unknown } }).key;
    return typeof key?.fromMe === 'boolean' ? key.fromMe : null;
  }

  /**
   * The counterpart number, masked. Enough to tell WHICH conversation a call belongs to, never enough to
   * reconstruct a list — the same rule the audit payloads follow (§16).
   */
  private static maskedRemote(payload: EvolutionWebhookRequestDto): string | null {
    const key = (EvolutionWebhookService.dataOf(payload) as { key?: { remoteJid?: unknown } }).key;
    if (typeof key?.remoteJid !== 'string' || !key.remoteJid) {
      return null;
    }
    const digits = key.remoteJid.split('@')[0].replace(/\D/g, '');
    if (digits.length < 6) {
      return '***';
    }
    return `${digits.slice(0, 4)}${'*'.repeat(digits.length - 8)}${digits.slice(-4)}`;
  }

  /**
   * Inbound message (§10.2 item 1).
   *
   * Hands it to the inbox, which owns the whole path: resolve the contact, create or reopen the ONE
   * conversation of that contact, download media in the act, classify, and let opt-out and
   * acknowledgement close themselves.
   *
   * What stays here belongs to the transport and nothing else: dropping our own echoes, refusing group
   * JIDs (out of scope for v1, §2), and translating Evolution vocabulary into a MessageKind.
   *
   * Outbound echoes are skipped for a specific reason: Evolution reports our own sends here too, and
   * treating one as inbound would opt a contact out because WE sent them the word "parar".
   */
  private async handleInbound(
    accountId: string,
    channelId: string,
    payload: EvolutionWebhookRequestDto,
  ): Promise<void> {
    const data = EvolutionWebhookService.dataOf(payload);
    const key = (data.key ?? {}) as { remoteJid?: string; fromMe?: boolean; id?: string };

    if (key.fromMe === true) {
      this.logger.log('Inbound ignorado — echo de mensagem própria (fromMe=true)');
      return;
    }

    const remoteJid = typeof key.remoteJid === 'string' ? key.remoteJid : '';
    // A JID looks like `5511999998888@s.whatsapp.net`; a group JID ends in `@g.us` and is out of
    // scope for v1 (§2), so anything that is not a plain contact JID is ignored.
    if (!remoteJid.endsWith('@s.whatsapp.net')) {
      this.logger.log(
        `Inbound ignorado — JID não é de contato individual: ${remoteJid.slice(-12)}`,
      );
      return;
    }
    const fromPhone = remoteJid.split('@')[0];

    const body = EvolutionWebhookService.extractBody(data);
    const kind = EvolutionWebhookService.extractKind(data);
    const media = EvolutionWebhookService.extractMedia(data);
    const occurredAt = EvolutionWebhookService.extractTimestamp(data);

    if (!body && kind === MessageKind.TEXT) {
      // A text event with no text is nothing to store. Media events legitimately have no body.
      this.logger.log('Inbound ignorado — evento sem corpo e sem mídia');
      return;
    }

    await this.runner.run(accountId, async () => {
      const result = await this.ingestInbound.execute(
        new IngestInboundMessageCommand(
          accountId,
          channelId,
          fromPhone,
          kind,
          body,
          // Provider message id: the idempotency key against webhook retries.
          typeof key.id === 'string' ? key.id : null,
          occurredAt,
          media.base64,
          media.url,
          media.mimeType,
          media.fileName,
        ),
      );

      if (result.ignoredReason) {
        this.logger.log(`Inbound NÃO ingerido — ${result.ignoredReason}`);
        return;
      }
      this.logger.log(
        `Inbound processado — intent=${result.intentClass} ` +
          `autoResolvido=${result.autoResolved} naFila=${result.queued}`,
      );
    });
  }

  /** Evolution message type → MessageKind. Anything unrecognised is OTHER, never guessed. */
  private static extractKind(data: Record<string, unknown>): MessageKind {
    const message = (data.message ?? {}) as Record<string, unknown>;
    if (message.audioMessage) {
      return MessageKind.AUDIO;
    }
    if (message.imageMessage) {
      return MessageKind.IMAGE;
    }
    if (message.videoMessage) {
      return MessageKind.VIDEO;
    }
    if (message.documentMessage) {
      return MessageKind.DOCUMENT;
    }
    if (message.stickerMessage) {
      return MessageKind.STICKER;
    }
    if (message.conversation || message.extendedTextMessage) {
      return MessageKind.TEXT;
    }

    const declared = typeof data.messageType === 'string' ? data.messageType.toLowerCase() : '';
    if (declared.includes('audio')) {
      return MessageKind.AUDIO;
    }
    if (declared.includes('image')) {
      return MessageKind.IMAGE;
    }
    if (declared.includes('video')) {
      return MessageKind.VIDEO;
    }
    if (declared.includes('document')) {
      return MessageKind.DOCUMENT;
    }
    if (declared.includes('sticker')) {
      return MessageKind.STICKER;
    }
    return declared.includes('text') || declared.includes('conversation')
      ? MessageKind.TEXT
      : MessageKind.OTHER;
  }

  /**
   * Media payload, in whichever of the two shapes Evolution used.
   *
   * Base64 first when present: it is already in hand and cannot expire between here and the download,
   * which is the whole point of §10.2 item 2.
   */
  private static extractMedia(data: Record<string, unknown>): {
    base64: string | null;
    url: string | null;
    mimeType: string | null;
    fileName: string | null;
  } {
    const message = (data.message ?? {}) as Record<string, Record<string, unknown> | undefined>;
    const payload =
      message.audioMessage ??
      message.imageMessage ??
      message.videoMessage ??
      message.documentMessage ??
      message.stickerMessage ??
      {};

    const base64 =
      typeof data.base64 === 'string'
        ? data.base64
        : typeof data.mediaBase64 === 'string'
          ? data.mediaBase64
          : null;

    return {
      base64,
      url: typeof payload.url === 'string' ? payload.url : null,
      mimeType: typeof payload.mimetype === 'string' ? payload.mimetype : null,
      fileName: typeof payload.fileName === 'string' ? payload.fileName : null,
    };
  }

  /**
   * When the CONTACT sent it, from the provider timestamp — not `new Date()`.
   *
   * The queue orders by age (§10.3 item 2), so using arrival time would make a message delayed by a
   * webhook retry look fresher than it is and push a genuinely old item further down.
   */
  private static extractTimestamp(data: Record<string, unknown>): Date {
    const raw = data.messageTimestamp;
    const seconds = typeof raw === 'number' ? raw : Number.parseInt(String(raw ?? ''), 10);
    if (Number.isFinite(seconds) && seconds > 0) {
      // Evolution sends seconds. A timestamp in the future is clamped rather than trusted.
      const candidate = new Date(seconds * 1000);
      return candidate.getTime() > Date.now() ? new Date() : candidate;
    }
    return new Date();
  }

  /** Pulls the text out of the shapes Evolution uses, without trusting any of them to exist. */
  private static extractBody(data: Record<string, unknown>): string | null {
    const message = (data.message ?? {}) as Record<string, unknown>;

    const conversation = message.conversation;
    if (typeof conversation === 'string' && conversation.trim()) {
      return conversation;
    }

    const extended = message.extendedTextMessage as { text?: string } | undefined;
    if (typeof extended?.text === 'string' && extended.text.trim()) {
      return extended.text;
    }

    // Caption of an image/video: someone can absolutely reply "PARAR" as a caption.
    for (const field of ['imageMessage', 'videoMessage', 'documentMessage']) {
      const media = message[field] as { caption?: string } | undefined;
      if (typeof media?.caption === 'string' && media.caption.trim()) {
        return media.caption;
      }
    }

    return null;
  }

  private static mapState(state: string | undefined): GatewayConnectionState | null {
    switch ((state ?? '').toLowerCase()) {
      case 'open':
        return GatewayConnectionState.OPEN;
      case 'connecting':
        return GatewayConnectionState.CONNECTING;
      case 'close':
      case 'closed':
        return GatewayConnectionState.CLOSED;
      default:
        return null;
    }
  }
}
