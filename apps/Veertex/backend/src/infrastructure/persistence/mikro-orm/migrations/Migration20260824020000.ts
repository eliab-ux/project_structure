import { Migration } from '@mikro-orm/migrations';

/**
 * FIN fatia 4 (05 §2.5): `customer_credits` — o crédito que a DEVOLUÇÃO pós-FIS gera quando o
 * título já estava recebido, consumível em título futuro. **Schema dormente**: nenhum fluxo grava
 * até o FIS existir (a devolução é operação coordenada, 02 §3.8); a tabela nasce agora para a
 * devolução entrar sem migração de dados. Tenant + RLS; select+insert+update para o runtime
 * (consumo atualiza remaining/status — não é append-only puro; nunca DELETE).
 */
export class Migration20260824020000 extends Migration {
  async up(): Promise<void> {
    const tenantScope = `nullif(current_setting('app.account_id', true), '')::uuid`;

    this.addSql(`
      create table if not exists "customer_credits" (
        "id" uuid primary key,
        "account_id" uuid not null,
        "company_id" uuid not null,
        "contact_id" uuid not null,
        "origin_title_id" uuid null,
        "amount" numeric(14,2) not null,
        "remaining_amount" numeric(14,2) not null,
        "status" varchar(20) not null default 'open',
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        "deleted_at" timestamptz null
      );
    `);
    this.addSql(`
      create index if not exists "customer_credits_contact_open_idx"
        on "customer_credits" ("account_id", "contact_id")
        where "status" = 'open' and "deleted_at" is null;
    `);

    this.addSql(`alter table "customer_credits" enable row level security;`);
    this.addSql(
      `drop policy if exists "customer_credits_tenant_isolation" on "customer_credits";`,
    );
    this.addSql(`
      create policy "customer_credits_tenant_isolation" on "customer_credits"
        for all
        using ("account_id" = ${tenantScope})
        with check ("account_id" = ${tenantScope});
    `);
    this.addSql(`
      do $$
      begin
        if exists (select 1 from pg_roles where rolname = 'veertex_app') then
          grant select, insert, update on table public.customer_credits to veertex_app;
        end if;
      end
      $$;
    `);
  }

  async down(): Promise<void> {
    this.addSql(`drop table if exists "customer_credits";`);
  }
}
