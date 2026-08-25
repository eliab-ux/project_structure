import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import {
  VideoThumbnail,
  VideoThumbnailPort,
} from '../../contexts/catalog/application/ports/output/video-thumbnail.port';

/**
 * Baixa a miniatura direto do CDN de imagens do YouTube (`i.ytimg.com`).
 *
 * Não usa a Data API de propósito: o CDN não consome quota, não precisa de chave e responde a
 * qualquer IP — é justamente o oposto da página do vídeo, que costuma devolver muro de
 * consentimento para IP de datacenter (foi o que impediu o Baileys de montar o cartão).
 */
@Injectable()
export class YoutubeThumbnailAdapter implements VideoThumbnailPort {
  private readonly logger = new Logger(YoutubeThumbnailAdapter.name);
  private readonly http: AxiosInstance;

  private static readonly TIMEOUT_MS = 8_000;

  /**
   * Em ordem de preferência. `maxresdefault` só existe para vídeo enviado em HD — para os demais
   * o CDN responde 404, e é por isso que a lista termina em `hqdefault`, que existe para todo
   * vídeo público.
   */
  private static readonly QUALITIES = ['maxresdefault', 'sddefault', 'hqdefault'] as const;

  /** 5 MB: acima disso não é miniatura, e o payload da Evolution vai em JSON. */
  private static readonly MAX_BYTES = 5 * 1024 * 1024;

  constructor() {
    this.http = axios.create({
      timeout: YoutubeThumbnailAdapter.TIMEOUT_MS,
      responseType: 'arraybuffer',
      // 404 de qualidade inexistente é resposta esperada, não erro: tratamos no laço.
      validateStatus: () => true,
      maxContentLength: YoutubeThumbnailAdapter.MAX_BYTES,
    });
  }

  async fetch(videoId: string): Promise<VideoThumbnail | null> {
    // `videoId` vem do catálogo, mas nunca é interpolado sem escape — evita path traversal na URL.
    const id = encodeURIComponent(videoId);

    for (const quality of YoutubeThumbnailAdapter.QUALITIES) {
      const thumbnail = await this.tryQuality(id, quality);
      if (thumbnail) {
        return thumbnail;
      }
    }

    this.logger.warn('Miniatura indisponível; a mensagem será enviada como texto', { videoId });
    return null;
  }

  private async tryQuality(id: string, quality: string): Promise<VideoThumbnail | null> {
    try {
      const response = await this.http.get<ArrayBuffer>(
        `https://i.ytimg.com/vi/${id}/${quality}.jpg`,
      );
      const contentType = String(response.headers['content-type'] ?? '');

      // O CDN responde 200 com uma imagem de placeholder para id inválido; exigir `image/` e um
      // tamanho mínimo descarta tanto isso quanto páginas de erro devolvidas com 200.
      if (response.status !== 200 || !contentType.startsWith('image/')) {
        return null;
      }
      const buffer = Buffer.from(response.data);
      if (buffer.byteLength < 1024) {
        return null;
      }
      return { base64: buffer.toString('base64'), mimeType: contentType.split(';')[0] };
    } catch (error) {
      this.logger.warn('Falha ao baixar a miniatura', {
        quality,
        reason: (error as Error)?.message,
      });
      return null;
    }
  }
}
