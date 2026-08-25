export const VIDEO_SOURCE = Symbol('VIDEO_SOURCE');

export interface SourceVideo {
  videoId: string;
  title: string;
  playlistId: string;
  publishedAt: Date | null;
}

/**
 * Fonte dos vídeos do canal. A escolha "YouTube Data API v3" fica isolada atrás deste port —
 * se a quota mudar ou a API quebrar, troca-se o adapter (RSS, scraping) sem tocar em use case.
 */
export interface VideoSourcePort {
  fetchAllChannelVideos(): Promise<SourceVideo[]>;
}
