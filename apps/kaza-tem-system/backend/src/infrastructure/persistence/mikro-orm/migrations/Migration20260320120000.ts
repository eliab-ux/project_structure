import { Migration } from '@mikro-orm/migrations';

export class Migration20260320120000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      alter table "resellers"
      add column if not exists "type" varchar(2) not null default 'pf',
      add column if not exists "birth_date" date,
      add column if not exists "address_zip_code" varchar(9),
      add column if not exists "address_street" varchar(255),
      add column if not exists "address_number" varchar(20),
      add column if not exists "address_complement" varchar(100),
      add column if not exists "address_neighborhood" varchar(100),
      add column if not exists "address_city" varchar(100),
      add column if not exists "address_state" varchar(2);
    `);
  }

  async down(): Promise<void> {
    this.addSql(`
      alter table "resellers"
      drop column if exists "address_state",
      drop column if exists "address_city",
      drop column if exists "address_neighborhood",
      drop column if exists "address_complement",
      drop column if exists "address_number",
      drop column if exists "address_street",
      drop column if exists "address_zip_code",
      drop column if exists "birth_date",
      drop column if exists "type";
    `);
  }
}
