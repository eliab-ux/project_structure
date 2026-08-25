import { Migration } from '@mikro-orm/migrations';

export class Migration20260728153113_CreateDailyVideos extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table "daily_videos" ("day_number" int not null, "title_day_number" int not null, "title" varchar(255) not null, "video_id" varchar(32) not null, "playlist_id" varchar(64) not null, "published_at" timestamptz null, "synced_at" timestamptz not null, constraint "daily_videos_pkey" primary key ("day_number"));`,
    );
    this.addSql(
      `create index "daily_videos_title_day_number_index" on "daily_videos" ("title_day_number");`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "daily_videos" cascade;`);
  }
}
