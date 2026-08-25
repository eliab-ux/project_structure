import { Inject, Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { randomUUID } from 'node:crypto';
import {
  DownloadedMedia,
  InboundMediaDownloaderPort,
} from '../../contexts/inbox/application/ports/output/inbox-repositories.port';
import { MessageKind } from '../../contexts/inbox/domain/value-objects/message-kind.vo';
import { FILE_STORAGE, FileStoragePort } from './ports/file-storage.port';

const DOWNLOAD_TIMEOUT_MS = 20_000;
/** A WhatsApp media message tops out well below this; the cap is against a hostile or broken payload. */
const MAX_BYTES = 40 * 1024 * 1024;

const EXTENSIONS: Record<string, string> = {
  'audio/ogg': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'application/pdf': 'pdf',
};

/**
 * Fetches inbound media and stores it immediately (§10.2 item 2).
 *
 * The spec's reason, verbatim: "Mídia recebida: baixar e persistir no MinIO **no ato**. URLs da Evolution
 * não são estáveis." A link stored now and fetched when an operator opens the item is a link that 404s,
 * and the message becomes an empty bubble nobody can explain — worst of all for audio, which §10.2 item 3
 * makes mandatory in v1 precisely because so much Brazilian inbound is voice.
 *
 * Two payload shapes, because Evolution uses both: an inline base64 (common for small audio) or a URL.
 * Base64 is preferred when present — it is already in hand and cannot expire mid-request.
 *
 * **A failure never throws.** It returns `failureReason`, and the caller keeps the message without the
 * file. An audio nobody can play is still evidence that this person replied, and dropping it would also
 * corrupt the `inbound_rate` the throttle reads (§2.1).
 */
@Injectable()
export class InboundMediaDownloader implements InboundMediaDownloaderPort {
  private readonly logger = new Logger(InboundMediaDownloader.name);

  constructor(@Inject(FILE_STORAGE) private readonly storage: FileStoragePort) {}

  async download(input: {
    accountId: string;
    conversationId: string;
    base64?: string | null;
    url?: string | null;
    mimeType?: string | null;
    fileName?: string | null;
    kind: MessageKind;
  }): Promise<DownloadedMedia> {
    const mimeType = input.mimeType ?? 'application/octet-stream';

    try {
      const body = input.base64
        ? Buffer.from(input.base64, 'base64')
        : await this.fetch(input.url ?? '');

      if (body.length === 0) {
        return this.failed(input.kind, mimeType, 'payload vazio');
      }
      if (body.length > MAX_BYTES) {
        return this.failed(input.kind, mimeType, `arquivo acima do limite (${body.length} bytes)`);
      }

      // Keyed by conversation so everything about one contact sits together in the bucket, and with a
      // random id so a repeated file name cannot overwrite an earlier message's media.
      const extension = EXTENSIONS[mimeType] ?? InboundMediaDownloader.extensionOf(input.fileName);
      const key = `inbox/${input.conversationId}/${randomUUID()}${extension ? `.${extension}` : ''}`;

      await this.storage.putObject({ accountId: input.accountId, key, body, mimeType });

      return {
        kind: input.kind,
        storageKey: key,
        mimeType,
        sizeBytes: body.length,
        failureReason: null,
      };
    } catch (error) {
      // Logged without the URL: an Evolution media URL carries a token.
      this.logger.error('Falha ao baixar mídia recebida', {
        conversationId: input.conversationId,
        kind: input.kind,
        reason: (error as Error)?.message,
      });
      return this.failed(input.kind, mimeType, (error as Error)?.message ?? 'falha desconhecida');
    }
  }

  private async fetch(url: string): Promise<Buffer> {
    if (!url) {
      throw new Error('sem base64 e sem URL');
    }
    const response = await axios.get<ArrayBuffer>(url, {
      responseType: 'arraybuffer',
      timeout: DOWNLOAD_TIMEOUT_MS,
      maxContentLength: MAX_BYTES,
      validateStatus: () => true,
    });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`HTTP ${response.status} ao baixar mídia`);
    }
    return Buffer.from(response.data);
  }

  private failed(kind: MessageKind, mimeType: string, reason: string): DownloadedMedia {
    return { kind, storageKey: null, mimeType, sizeBytes: null, failureReason: reason };
  }

  private static extensionOf(fileName: string | null | undefined): string {
    const match = /\.([a-z0-9]{1,5})$/i.exec(fileName ?? '');
    return match ? match[1].toLowerCase() : '';
  }
}
