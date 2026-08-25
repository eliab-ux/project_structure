import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { ResolveOwnerByIgUserIdUseCase } from '../../../../contexts/connection/application/use-cases/resolve-owner-by-ig-user-id/resolve-owner-by-ig-user-id.use-case';
import { DetectionType } from '../../../../contexts/detection/domain/value-objects/detection-type.vo';
import { DetectionIngestionService } from '../../../ingestion/detection-ingestion.service';

interface WebhookChange {
  field?: string;
  value?: Record<string, unknown>;
}
interface WebhookEntry {
  id?: string;
  time?: number;
  changes?: WebhookChange[];
}
export interface InstagramWebhookPayload {
  object?: string;
  entry?: WebhookEntry[];
}

/**
 * Verifies, deduplicates and routes inbound Meta webhook deliveries to the correct tenant.
 * ⚠️ ECOA_SPEC: the exact `mentions` payload shape must be confirmed against Meta's current docs;
 * fields are read defensively and anything absent degrades gracefully (never throws on the
 * client-facing path).
 */
@Injectable()
export class InstagramWebhookService {
  private readonly logger = new Logger(InstagramWebhookService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly resolveOwner: ResolveOwnerByIgUserIdUseCase,
    private readonly ingestion: DetectionIngestionService,
  ) {}

  /** GET handshake: echo the challenge only when the verify token matches. */
  verifyHandshake(mode?: string, token?: string, challenge?: string): string | null {
    const expected = this.config.get<string>('META_WEBHOOK_VERIFY_TOKEN');
    if (mode === 'subscribe' && expected && token === expected) {
      return challenge ?? '';
    }
    return null;
  }

  /** Validates X-Hub-Signature-256 (HMAC-SHA256 of the RAW body with the app secret). */
  verifySignature(rawBody: Buffer | undefined, signatureHeader?: string): boolean {
    const appSecret = this.config.get<string>('META_APP_SECRET');
    if (!appSecret || !rawBody || !signatureHeader?.startsWith('sha256=')) {
      return false;
    }
    const expected = createHmac('sha256', appSecret).update(rawBody).digest('hex');
    const provided = signatureHeader.slice('sha256='.length);
    const expectedBuf = Buffer.from(expected, 'hex');
    const providedBuf = Buffer.from(provided, 'hex');
    if (expectedBuf.length !== providedBuf.length) {
      return false;
    }
    return timingSafeEqual(expectedBuf, providedBuf);
  }

  /**
   * Resolves the tenant for each entry via ig_user_id and ingests a detection per relevant change.
   * An entry whose ig_user_id matches no connection is discarded (logged, not processed).
   */
  async process(rawBody: Buffer | undefined, payload: InstagramWebhookPayload): Promise<void> {
    const payloadHash = rawBody
      ? createHash('sha256').update(rawBody).digest('hex')
      : createHash('sha256').update(JSON.stringify(payload)).digest('hex');

    for (const entry of payload.entry ?? []) {
      const igUserId = entry.id;
      if (!igUserId) {
        continue;
      }
      const resolved = await this.resolveOwner.execute({ igUserId });
      if (!resolved) {
        this.logger.warn('Webhook órfão descartado (ig_user_id sem conexão)', { igUserId });
        continue;
      }

      for (const [index, change] of (entry.changes ?? []).entries()) {
        const value = change.value ?? {};
        const sourceUsername = this.extractUsername(value);
        if (!sourceUsername) {
          continue;
        }
        const externalId = `wh:${igUserId}:${entry.time ?? 0}:${change.field ?? 'x'}:${index}:${payloadHash.slice(0, 16)}`;
        await this.ingestion.ingest({
          ownerId: resolved.ownerId,
          sourceUsername,
          detectionType: this.mapType(change.field, value),
          igMediaId: this.extractString(value, 'media_id'),
          permalink: this.extractString(value, 'permalink'),
          detectedAt: entry.time ? new Date(entry.time * 1000) : new Date(),
          externalId,
          payloadHash,
        });
      }
    }
  }

  /**
   * Maps a webhook change to a detection type.
   *
   * The `mentions` field covers TWO different things, told apart by the payload: a caption
   * mention carries only `media_id`, a comment mention also carries `comment_id`. The caption
   * case is the one that matters to Ecoa — it is what a repost with the @ preserved looks like.
   * It does NOT cover story reshares; Meta does not expose those on this API.
   */
  private mapType(field: string | undefined, value: Record<string, unknown>): DetectionType {
    switch ((field ?? '').toLowerCase()) {
      case 'tags':
      case 'tag':
        return DetectionType.TAG;
      case 'mentions':
      case 'mention':
      default:
        return this.extractString(value, 'comment_id')
          ? DetectionType.COMMENT_MENTION
          : DetectionType.CAPTION_MENTION;
    }
  }

  private extractUsername(value: Record<string, unknown>): string | null {
    const direct = this.extractString(value, 'username');
    if (direct) {
      return direct.toLowerCase();
    }
    const from = value['from'];
    if (from && typeof from === 'object' && 'username' in from) {
      const u = (from as { username?: unknown }).username;
      return typeof u === 'string' ? u.toLowerCase() : null;
    }
    return null;
  }

  private extractString(value: Record<string, unknown>, key: string): string | null {
    const v = value[key];
    return typeof v === 'string' && v.length > 0 ? v : null;
  }
}
