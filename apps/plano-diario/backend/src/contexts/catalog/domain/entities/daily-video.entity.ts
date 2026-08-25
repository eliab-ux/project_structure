import { AggregateRoot } from '@gitspread/domain-primitives';
import { YoutubeVideoId } from '../value-objects/youtube-video-id.vo';

/**
 * Uma leitura do plano. Catálogo GLOBAL — não tem `userId`, porque o plano de leitura é o
 * mesmo para todos os usuários.
 *
 * `dayNumber` é a **posição na sequência** de leituras, não o número escrito no título:
 * a numeração do canal tem furos e um duplicado (ver `reading-sequence.ts`).
 * `titleDayNumber` fica guardado só para auditoria.
 */
export class DailyVideo extends AggregateRoot {
  private constructor(
    private readonly _dayNumber: number,
    private _titleDayNumber: number,
    private _title: string,
    private _videoId: YoutubeVideoId,
    private _playlistId: string,
    private _publishedAt: Date | null,
    private _syncedAt: Date,
  ) {
    super();
  }

  static create(params: {
    dayNumber: number;
    titleDayNumber: number;
    title: string;
    videoId: YoutubeVideoId;
    playlistId: string;
    publishedAt: Date | null;
    syncedAt?: Date;
  }): DailyVideo {
    if (!Number.isInteger(params.dayNumber) || params.dayNumber < 1) {
      throw new Error('dayNumber must be a positive integer');
    }
    return new DailyVideo(
      params.dayNumber,
      params.titleDayNumber,
      params.title,
      params.videoId,
      params.playlistId,
      params.publishedAt,
      params.syncedAt ?? new Date(),
    );
  }

  /** Atualiza o conteúdo de um dia já existente (usado no upsert da sync). */
  refreshFrom(params: {
    titleDayNumber: number;
    title: string;
    videoId: YoutubeVideoId;
    playlistId: string;
    publishedAt: Date | null;
  }): void {
    this._titleDayNumber = params.titleDayNumber;
    this._title = params.title;
    this._videoId = params.videoId;
    this._playlistId = params.playlistId;
    this._publishedAt = params.publishedAt;
    this._syncedAt = new Date();
  }

  /** Mudou algo que o usuário veria na mensagem? Evita UPDATE inútil a cada sync. */
  differsFrom(params: { titleDayNumber: number; title: string; videoId: string }): boolean {
    return (
      this._titleDayNumber !== params.titleDayNumber ||
      this._title !== params.title ||
      this._videoId.value !== params.videoId
    );
  }

  get dayNumber(): number {
    return this._dayNumber;
  }
  get titleDayNumber(): number {
    return this._titleDayNumber;
  }
  get title(): string {
    return this._title;
  }
  get videoId(): YoutubeVideoId {
    return this._videoId;
  }
  get playlistId(): string {
    return this._playlistId;
  }
  get publishedAt(): Date | null {
    return this._publishedAt;
  }
  get syncedAt(): Date {
    return this._syncedAt;
  }
}
