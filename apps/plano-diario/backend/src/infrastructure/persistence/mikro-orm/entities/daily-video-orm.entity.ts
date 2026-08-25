import { Entity, Index, PrimaryKey, Property } from '@mikro-orm/core';

/**
 * Catálogo GLOBAL — sem `user_id` de propósito: o plano de leitura é o mesmo para todos.
 * `day_number` é a posição na sequência de leituras (chave de resolução do dia);
 * `title_day_number` é o número lido do título, guardado só para auditoria.
 */
@Entity({ tableName: 'daily_videos' })
export class DailyVideoOrmEntity {
  // autoincrement: false — a posição é atribuída pela sequência de leituras, não pelo banco.
  @PrimaryKey({ fieldName: 'day_number', autoincrement: false })
  dayNumber!: number;

  @Property({ fieldName: 'title_day_number' })
  @Index()
  titleDayNumber!: number;

  @Property({ length: 255 })
  title!: string;

  @Property({ fieldName: 'video_id', length: 32 })
  videoId!: string;

  @Property({ fieldName: 'playlist_id', length: 64 })
  playlistId!: string;

  // O tipo é explícito: o MikroORM infere `varchar` para a união `Date | null`.
  @Property({ fieldName: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt?: Date | null;

  @Property({ fieldName: 'synced_at' })
  syncedAt: Date = new Date();
}
