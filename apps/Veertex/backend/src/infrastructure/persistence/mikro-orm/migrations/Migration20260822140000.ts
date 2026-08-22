import { Migration } from '@mikro-orm/migrations';

/**
 * CARTEIRIZAÇÃO (§2.3 do 02 / ADR-0007). Migration ADITIVA em coluna, mas **altera a policy de RLS de
 * `contacts`** — o único ponto desta fatia que toca o isolamento, e por isso o mais cuidadoso.
 *
 * Três coisas:
 *  1. `accounts.contact_carteirizacao` — a preferência (default `false`).
 *  2. `contacts.sales_rep_id` — o vendedor vinculado (FK `users`, `on delete set null`; usuários são
 *     soft-deletados, então o set null é defensivo).
 *  3. **Recria a policy `contacts_tenant_isolation`** somando o filtro por ator: além do
 *     `account_id`, o `sales_rep_id` tem de casar com `app.contact_scope` QUANDO o escopo está
 *     definido. Escopo vazio (ator não restrito, ou preferência desligada) = vê todos os contatos da
 *     conta, como antes. O `WITH CHECK` continua só por conta — a atribuição do vendedor é da
 *     aplicação; a policy governa a VISIBILIDADE.
 *
 * `app.contact_scope` é setado por request pelo `ContactScopeService` (nunca por claim — ADR-0007).
 * Vazio/ausente → `nullif(...) is null` → primeiro ramo do OR → vê tudo (dentro da conta). Nunca
 * compromete o isolamento por CONTA: o `account_id = <tenantScope>` é conjunção, sempre aplicado.
 *
 * O `verify:isolation` continua verde: `contacts` segue com RLS ligado e uma policy (ele checa
 * existência, não conteúdo).
 */
export class Migration20260822140000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      alter table "accounts"
        add column if not exists "contact_carteirizacao" boolean not null default false;
    `);

    this.addSql(`
      alter table "contacts"
        add column if not exists "sales_rep_id" uuid null;
    `);
    this.addSql(`
      do $$
      begin
        if not exists (
          select 1 from pg_constraint where conname = 'contacts_sales_rep_id_foreign'
        ) then
          alter table "contacts"
            add constraint "contacts_sales_rep_id_foreign"
            foreign key ("sales_rep_id") references "users" ("id")
            on update cascade on delete set null;
        end if;
      end
      $$;
    `);
    this.addSql(
      `create index if not exists "contacts_sales_rep_id_index" on "contacts" ("sales_rep_id");`,
    );

    // ── Recria a policy de contacts, somando o filtro de carteirização ──────────────────────────
    const tenantScope = `nullif(current_setting('app.account_id', true), '')::uuid`;
    const contactScope = `nullif(current_setting('app.contact_scope', true), '')`;

    this.addSql(`drop policy if exists "contacts_tenant_isolation" on "contacts";`);
    this.addSql(`
      create policy "contacts_tenant_isolation" on "contacts"
        for all
        using (
          "account_id" = ${tenantScope}
          and (
            ${contactScope} is null
            or "sales_rep_id" = ${contactScope}::uuid
          )
        )
        with check ("account_id" = ${tenantScope});
    `);
  }

  async down(): Promise<void> {
    // Volta a policy ao formato só-por-conta.
    const tenantScope = `nullif(current_setting('app.account_id', true), '')::uuid`;
    this.addSql(`drop policy if exists "contacts_tenant_isolation" on "contacts";`);
    this.addSql(`
      create policy "contacts_tenant_isolation" on "contacts"
        for all
        using ("account_id" = ${tenantScope})
        with check ("account_id" = ${tenantScope});
    `);
    this.addSql(`drop index if exists "contacts_sales_rep_id_index";`);
    this.addSql(
      `alter table "contacts" drop constraint if exists "contacts_sales_rep_id_foreign";`,
    );
    this.addSql(`alter table "contacts" drop column if exists "sales_rep_id";`);
    this.addSql(`alter table "accounts" drop column if exists "contact_carteirizacao";`);
  }
}
