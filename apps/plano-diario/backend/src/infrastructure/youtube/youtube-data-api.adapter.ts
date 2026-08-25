import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import {
  SourceVideo,
  VideoSourcePort,
} from '../../contexts/catalog/application/ports/output/video-source.port';

interface ChannelsResponse {
  items?: Array<{
    id: string;
    snippet?: { title?: string };
    contentDetails?: { relatedPlaylists?: { uploads?: string } };
  }>;
}

interface PlaylistItemsResponse {
  items?: Array<{
    snippet?: { title?: string };
    contentDetails?: { videoId?: string; videoPublishedAt?: string };
  }>;
  nextPageToken?: string;
}

interface SearchResponse {
  items?: Array<{ snippet?: { channelId?: string } }>;
}

/**
 * Adapter da YouTube Data API v3 (somente leitura de conteúdo público → API key, não OAuth).
 *
 * Estratégia: resolve o canal pelo handle, pega a **playlist de uploads** e pagina ela.
 * Isso difere da spec §6.1, que mandava iterar as playlists do canal — o diagnóstico real
 * mostrou que as playlists "Videos 2026/2025 - Leitura da Bíblia" têm ZERO vídeos numerados,
 * enquanto a playlist de uploads contém todas as leituras. Uploads custa ~12 chamadas contra
 * ~84 das playlists, e todo vídeo novo entra nela automaticamente.
 */
@Injectable()
export class YoutubeDataApiAdapter implements VideoSourcePort {
  private readonly logger = new Logger(YoutubeDataApiAdapter.name);
  private readonly http: AxiosInstance;

  constructor(private readonly configService: ConfigService) {
    this.http = axios.create({
      baseURL: 'https://www.googleapis.com/youtube/v3',
      timeout: 10_000,
    });

    // A API key vai na query string. O interceptor de erro mascara a URL antes de logar,
    // senão a chave apareceria em texto puro em todo log de falha.
    this.http.interceptors.response.use(
      (response) => response,
      (error) => {
        const url = this.maskKey(error?.config?.url ?? '');
        const status = error?.response?.status;
        const reason = error?.response?.data?.error?.errors?.[0]?.reason;
        this.logger.error('Falha na YouTube Data API', { url, status, reason });
        return Promise.reject(error);
      },
    );
  }

  async fetchAllChannelVideos(): Promise<SourceVideo[]> {
    const uploadsPlaylistId = await this.resolveUploadsPlaylist();
    const videos = await this.fetchPlaylistItems(uploadsPlaylistId);
    this.logger.log('Vídeos obtidos do canal', {
      uploadsPlaylistId,
      count: videos.length,
    });
    return videos;
  }

  private async resolveUploadsPlaylist(): Promise<string> {
    const handle = this.configService.get<string>(
      'YOUTUBE_CHANNEL_HANDLE',
      'caminhandocomharoldwalker',
    );

    let channel = await this.fetchChannelByHandle(handle);

    if (!channel) {
      // `forHandle` é relativamente novo na API. Fallback documentado na spec §6.1:
      // search.list custa 100 unidades de quota (contra 1), por isso só no plano B.
      this.logger.warn('forHandle não retornou o canal; usando search.list como fallback', {
        handle,
      });
      channel = await this.fetchChannelBySearch(handle);
    }

    const uploads = channel?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploads) {
      throw new Error(`Não foi possível resolver a playlist de uploads do canal "${handle}"`);
    }
    return uploads;
  }

  private async fetchChannelByHandle(handle: string) {
    const { data } = await this.http.get<ChannelsResponse>('/channels', {
      params: {
        part: 'snippet,contentDetails',
        forHandle: handle,
        key: this.apiKey(),
      },
    });
    return data.items?.[0];
  }

  private async fetchChannelBySearch(handle: string) {
    const { data } = await this.http.get<SearchResponse>('/search', {
      params: { part: 'snippet', q: handle, type: 'channel', maxResults: 1, key: this.apiKey() },
    });
    const channelId = data.items?.[0]?.snippet?.channelId;
    if (!channelId) {
      return undefined;
    }
    const { data: channels } = await this.http.get<ChannelsResponse>('/channels', {
      params: { part: 'snippet,contentDetails', id: channelId, key: this.apiKey() },
    });
    return channels.items?.[0];
  }

  private async fetchPlaylistItems(playlistId: string): Promise<SourceVideo[]> {
    const videos: SourceVideo[] = [];
    let pageToken: string | undefined;
    let pages = 0;

    do {
      const { data } = await this.http.get<PlaylistItemsResponse>('/playlistItems', {
        params: {
          part: 'snippet,contentDetails',
          playlistId,
          maxResults: 50,
          pageToken,
          key: this.apiKey(),
        },
      });

      for (const item of data.items ?? []) {
        const videoId = item.contentDetails?.videoId;
        if (!videoId) {
          continue;
        }
        videos.push({
          videoId,
          title: item.snippet?.title ?? '',
          playlistId,
          publishedAt: item.contentDetails?.videoPublishedAt
            ? new Date(item.contentDetails.videoPublishedAt)
            : null,
        });
      }

      pageToken = data.nextPageToken;
      pages += 1;
      // Trava de segurança: 200 páginas = 10.000 vídeos. Protege contra loop de paginação.
    } while (pageToken && pages < 200);

    return videos;
  }

  private apiKey(): string {
    const key = this.configService.get<string>('YOUTUBE_API_KEY');
    if (!key) {
      throw new Error('YOUTUBE_API_KEY não configurada');
    }
    return key;
  }

  private maskKey(url: string): string {
    return url.replace(/([?&]key=)[^&]+/i, '$1***');
  }
}
