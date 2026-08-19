import { Migration } from '@mikro-orm/migrations';

/**
 * PRODUTOS — §3.5 do CORE. Duas tabelas, ambas de TENANT.
 *
 * `products` e `product_suppliers`. Cada uma carrega `account_id NOT NULL` e tem **policy de RLS
 * própria** — mesmo desenho do Contato, e pelo mesmo motivo: **RLS não segue JOIN**. Uma policy só em
 * `products` protegeria `select * from products join product_suppliers ...`, e não protegeria
 * `select * from product_suppliers` — consulta legítima que qualquer código futuro pode escrever, e
 * que devolveria os fornecedores de todas as contas. O `verify:isolation` recusa tabela com
 * `account_id` e sem policy exatamente para tornar esse esquecimento impossível.
 *
 * ## ⚠️ Colunas que NÃO existem, e cada ausência é decisão registrada
 *
 * | Ausente | Por que |
 * |---|---|
 * | composição de KIT (`product_components`) | o kit ficou fora POR INTEIRO (Eliab, 19/08/2026): sem o EST, montar composição e vender **não move estoque**, e isso é comportamento errado silencioso — diferente de um campo inerte, que a tela consegue avisar |
 * | `stock_quantity`, `average_cost` | saldo e custo médio são do EST. Coluna aqui seria número que ninguém atualiza, e alguém somaria |
 * | `product_images` / `image_object_key` | MinIO não existe no ambiente (nenhuma variável, nenhuma dependência, nenhum serviço). Chave de objeto que nada produz sugere recurso que não há |
 * | `cfop` | §3.5, explícito: *"CFOP NÃO é campo de configuração global (erro do Nexo a não repetir)"*. Deriva de natureza de operação × contexto — é do FIS |
 * | `category_id` | a árvore de categorias não existe. Há `category_path` em texto, e o nome antecipa a migração: quando a árvore vier, `category_id` entra ao lado sem colidir |
 *
 * Migration ADITIVA: só cria. Nada é apagado, nada é alterado em tabela existente.
 */
export class Migration20260819100000 extends Migration {
  async up(): Promise<void> {
    // ── products ───────────────────────────────────────────────────────────────────────────────
    this.addSql(`
      create table if not exists "products" (
        "id" uuid not null,
        "account_id" uuid not null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        "deleted_at" timestamptz null,
        "name" varchar(200) not null,
        "sku" varchar(60) null,
        "format" varchar(20) not null default 'simple',
        "kind" varchar(20) not null default 'product',
        "unit" varchar(6) not null,
        "condition" varchar(10) not null default 'new',
        "base_price" numeric(14,2) null,
        "brand" varchar(100) null,
        "category_path" varchar(300) null,
        "tags" text[] not null default '{}',
        "own_production" boolean not null default false,
        "shelf_life_days" int null,
        "barcode" varchar(20) null,
        "dun14" varchar(20) null,
        "short_description" varchar(500) null,
        "long_description" text null,
        "external_url" varchar(500) null,
        "video_url" varchar(500) null,
        "net_weight_kg" numeric(12,3) null,
        "gross_weight_kg" numeric(12,3) null,
        "width_cm" numeric(12,3) null,
        "height_cm" numeric(12,3) null,
        "length_cm" numeric(12,3) null,
        "items_per_box" int null,
        "minimum_quantity" numeric(14,3) null,
        "maximum_quantity" numeric(14,3) null,
        "stock_location" varchar(100) null,
        "tax_origin" varchar(1) null,
        "ncm" varchar(8) null,
        "cest" varchar(7) null,
        "item_type" varchar(60) null,
        "approximate_tax_percent" numeric(5,2) null,
        "tax_group" varchar(100) null,
        "taxable_barcode" varchar(20) null,
        "active" boolean not null default true,
        constraint "products_pkey" primary key ("id")
      );
    `);
    this.addSql(
      `alter table "products" add constraint "products_account_id_foreign"
         foreign key ("account_id") references "accounts" ("id") on update cascade;`,
    );
    this.addSql(
      `create index if not exists "products_account_id_index" on "products" ("account_id");`,
    );
    this.addSql(`create index if not exists "products_name_index" on "products" ("name");`);
    this.addSql(`create index if not exists "products_sku_index" on "products" ("sku");`);
    this.addSql(`create index if not exists "products_brand_index" on "products" ("brand");`);
    this.addSql(`create index if not exists "products_barcode_index" on "products" ("barcode");`);
    this.addSql(`create index if not exists "products_ncm_index" on "products" ("ncm");`);

    /*
     * Índice no caminho da categoria — e ele serve ao filtro por PREFIXO.
     *
     * Sem a árvore, filtrar "Ferramentas" tem de trazer "Ferramentas > Manuais", o que em SQL é
     * `category_path like 'Ferramentas%'`. Um btree comum atende prefixo com `like` **desde que a
     * ordenação seja C**; com o collate padrão do banco, ele não atende. Por isso o índice declara
     * `varchar_pattern_ops`, que é a classe de operadores feita para esse caso.
     *
     * Sem isso o filtro funcionaria e faria varredura completa — o tipo de coisa que passa em teste
     * com 10 produtos e aparece com 10 mil.
     */
    this.addSql(`
      create index if not exists "products_category_path_prefix"
        on "products" ("category_path" varchar_pattern_ops);
    `);

    // GIN em `tags` — mesma escolha dos tipos do contato: o filtro é "tem esta tag?", que em SQL é
    // `tags @> ARRAY['promocao']`, e é o que o GIN atende sem join.
    this.addSql(`create index if not exists "products_tags_gin" on "products" using gin ("tags");`);

    /*
     * Únicos PARCIAIS por conta — o mesmo padrão das demais tabelas.
     *
     * `where deleted_at is null`: linha soft-deletada não pode impedir o recadastro do mesmo SKU
     * depois. E `where ... is not null` porque SKU e GTIN são opcionais — sem isso, dois produtos sem
     * SKU colidiriam entre si, e o segundo cadastro do balcão falharia sem explicação.
     *
     * A unicidade é por CONTA, nunca global: "CX-100" é o código de alguém em toda loja do país, e um
     * índice global recusaria o cadastro de um cliente porque outro chegou primeiro.
     */
    this.addSql(`
      create unique index if not exists "products_account_sku_unique"
        on "products" ("account_id", "sku")
        where "deleted_at" is null and "sku" is not null;
    `);
    this.addSql(`
      create unique index if not exists "products_account_barcode_unique"
        on "products" ("account_id", "barcode")
        where "deleted_at" is null and "barcode" is not null;
    `);

    // ── product_suppliers ──────────────────────────────────────────────────────────────────────
    this.addSql(`
      create table if not exists "product_suppliers" (
        "id" uuid not null,
        "account_id" uuid not null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        "deleted_at" timestamptz null,
        "product_id" uuid not null,
        "contact_id" uuid not null,
        "supplier_description" varchar(200) null,
        "supplier_sku" varchar(60) null,
        "cost" numeric(14,2) null,
        "is_default" boolean not null default false,
        constraint "product_suppliers_pkey" primary key ("id")
      );
    `);
    this.addSql(
      `alter table "product_suppliers" add constraint "product_suppliers_product_id_foreign"
         foreign key ("product_id") references "products" ("id") on update cascade on delete cascade;`,
    );
    /*
     * `on delete restrict` no contato, e não cascade.
     *
     * Apagar um contato que é fornecedor de produtos deixaria os produtos apontando para o nada. Como
     * o sistema faz soft-delete, o caso normal nunca chega aqui — a restrição existe para o caminho
     * anormal (um DELETE do papel owner numa manutenção), que é justamente quando ninguém está
     * olhando o resultado.
     */
    this.addSql(
      `alter table "product_suppliers" add constraint "product_suppliers_contact_id_foreign"
         foreign key ("contact_id") references "contacts" ("id") on update cascade on delete restrict;`,
    );
    this.addSql(
      `alter table "product_suppliers" add constraint "product_suppliers_account_id_foreign"
         foreign key ("account_id") references "accounts" ("id") on update cascade;`,
    );
    this.addSql(
      `create index if not exists "product_suppliers_account_id_index" on "product_suppliers" ("account_id");`,
    );
    this.addSql(
      `create index if not exists "product_suppliers_product_id_index" on "product_suppliers" ("product_id");`,
    );
    /*
     * Índice em `contact_id` — e ele é o índice da pergunta INVERSA.
     *
     * "Quais produtos eu compro deste fornecedor?" parte do contato para o produto, e é a consulta da
     * cotação de compras (CMP futuro). Sem este índice ela varre a tabela inteira. É também a razão
     * de os fornecedores serem tabela e não `jsonb`.
     */
    this.addSql(
      `create index if not exists "product_suppliers_contact_id_index" on "product_suppliers" ("contact_id");`,
    );
    this.addSql(`
      create unique index if not exists "product_suppliers_product_contact_unique"
        on "product_suppliers" ("product_id", "contact_id")
        where "deleted_at" is null;
    `);

    // ── RLS: uma policy por tabela, sem exceção ────────────────────────────────────────────────
    const tenantScope = `nullif(current_setting('app.account_id', true), '')::uuid`;

    for (const table of ['products', 'product_suppliers']) {
      this.addSql(`alter table "${table}" enable row level security;`);
      this.addSql(`drop policy if exists "${table}_tenant_isolation" on "${table}";`);
      this.addSql(`
        create policy "${table}_tenant_isolation" on "${table}"
          for all
          using ("account_id" = ${tenantScope})
          with check ("account_id" = ${tenantScope});
      `);
    }

    // ── Grants ao papel de runtime ─────────────────────────────────────────────────────────────
    // Condicional, como nas migrations anteriores: ambiente de desenvolvimento com um usuário só
    // precisa migrar sem falhar num GRANT para papel que nunca criou.
    //
    // ⚠️ SEM DELETE — nem para `product_suppliers`, e a ausência é deliberada.
    //
    // A sincronização dos fornecedores (substituir a lista a cada gravação) pediria `DELETE`, e
    // conceder quebraria o invariante que o `verify:isolation` verifica: *"o papel de runtime não tem
    // DELETE"*. Esse invariante garante que uma falha na aplicação não consiga apagar dado de
    // cliente. A saída foi a mesma do Contato: soft-delete também na filha.
    this.addSql(`
      do $$
      begin
        if exists (select 1 from pg_roles where rolname = 'veertex_app') then
          grant select, insert, update on table public.products to veertex_app;
          grant select, insert, update on table public.product_suppliers to veertex_app;
        end if;
      end
      $$;
    `);
  }

  async down(): Promise<void> {
    // Ordem inversa da criação: a filha primeiro, por causa das FKs.
    this.addSql(`drop table if exists "product_suppliers" cascade;`);
    this.addSql(`drop table if exists "products" cascade;`);
  }
}
