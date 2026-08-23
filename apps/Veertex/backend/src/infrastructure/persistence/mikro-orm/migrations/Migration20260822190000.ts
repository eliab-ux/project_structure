import { Migration } from '@mikro-orm/migrations';

/**
 * VND — change requests do `02A_Veertex_Vnd_Complemento.md`:
 *  - **§3.1** origem canônica `{erp,pdv,rota,vitrine,marketplace}` + `delivery_mode` + `origin_detail`;
 *  - **§3.3** estágio `orcamento` como situação de primeira classe (+ `valid_until`).
 *
 * Migration ADITIVA. Os valores antigos de `origin` (`balcao/representante/telefone/importacao`)
 * são remapeados (§3.1 do 02A): `balcao→pdv`, `representante→rota`, `telefone→erp`, `importacao→erp`.
 * A granularidade perdida iria para `origin_detail`, mas o backfill não a inventa — só preserva quando
 * já dava para saber (telefone/importação, que viram `erp`).
 */
export class Migration20260822190000 extends Migration {
  async up(): Promise<void> {
    // ── Colunas novas ──────────────────────────────────────────────────────────────────────────
    this.addSql(`
      alter table "orders"
        add column if not exists "delivery_mode" varchar(20) not null default 'retirada';
    `);
    this.addSql(`alter table "orders" add column if not exists "origin_detail" text null;`);
    this.addSql(`alter table "orders" add column if not exists "valid_until" timestamptz null;`);

    // ── Preserva a granularidade que o enum canônico não guarda, ANTES de remapear ──────────────
    this.addSql(`
      update "orders" set "origin_detail" = "origin"
      where "origin" in ('telefone', 'importacao') and "origin_detail" is null;
    `);

    // ── Remapeia os valores antigos para o enum canônico (§3.1 do 02A) ──────────────────────────
    this.addSql(`update "orders" set "origin" = 'pdv'  where "origin" = 'balcao';`);
    this.addSql(`update "orders" set "origin" = 'rota' where "origin" = 'representante';`);
    this.addSql(
      `update "orders" set "origin" = 'erp'  where "origin" in ('telefone', 'importacao');`,
    );

    // ── Estágio `orcamento` no check de status ──────────────────────────────────────────────────
    this.addSql(`alter table "orders" drop constraint if exists "orders_status_check";`);
    this.addSql(`
      alter table "orders"
        add constraint "orders_status_check" check ("status" in
          ('rascunho','orcamento','confirmado','faturado','concluido','cancelado'));
    `);
  }

  async down(): Promise<void> {
    this.addSql(`alter table "orders" drop constraint if exists "orders_status_check";`);
    this.addSql(`
      alter table "orders"
        add constraint "orders_status_check" check ("status" in
          ('rascunho','confirmado','faturado','concluido','cancelado'));
    `);
    // Remapeia de volta (aproximação: pdv→balcao, rota→representante, erp→telefone).
    this.addSql(`update "orders" set "origin" = 'balcao'        where "origin" = 'pdv';`);
    this.addSql(`update "orders" set "origin" = 'representante' where "origin" = 'rota';`);
    this.addSql(`update "orders" set "origin" = 'telefone'      where "origin" = 'erp';`);
    this.addSql(`alter table "orders" drop column if exists "valid_until";`);
    this.addSql(`alter table "orders" drop column if exists "origin_detail";`);
    this.addSql(`alter table "orders" drop column if exists "delivery_mode";`);
  }
}
