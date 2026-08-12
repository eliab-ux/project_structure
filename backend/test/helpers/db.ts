import { Client } from 'pg';

/**
 * Conexão como OWNER para os testes de execução.
 *
 * Owner, e não o papel de runtime, porque estes testes precisam LIMPAR o que criaram — e
 * `veertex_app` não tem `DELETE` (é a parte de menor privilégio do provisionamento; exclusão no
 * Veertex é soft delete). Owner também não é afetado por RLS, que é o necessário para conferir o
 * efeito de um comando sem antes estabelecer escopo de conta.
 *
 * ⚠️ Isto vale para VERIFICAR e LIMPAR. Nenhum teste deve exercitar comportamento de aplicação
 * como owner: o dono ignora as policies, e o teste ficaria verde com o isolamento desligado. Quem
 * exercita o runtime é o `tenant-isolation.spec.ts`, que conecta como `veertex_app` de propósito.
 */
export async function connectAsOwner(): Promise<Client> {
  const connectionString = process.env.DATABASE_URL_MIGRATIONS;
  if (!connectionString) {
    // Falha, não pula: um teste que se auto-desativa quando o ambiente não está configurado é um
    // teste que some do CI sem ninguém notar.
    throw new Error('DATABASE_URL_MIGRATIONS é necessária para os testes de execução.');
  }
  const client = new Client({ connectionString });
  await client.connect();
  return client;
}

/**
 * As tabelas de tenant, na ordem de exclusão — filhas antes das mães —, DERIVADAS do catálogo do
 * Postgres em vez de escritas à mão.
 *
 * A versão anterior listava as cinco tabelas da F1 literalmente, e quebrou no dia em que a F2
 * acrescentou `account_modules`: 59 testes falharam de uma vez com violação de chave estrangeira, e
 * a mensagem apontava para o `delete from accounts` — não para a tabela nova que faltava na lista.
 * Uma lista escrita à mão é uma cópia do schema, e cópia do schema envelhece na próxima migration.
 *
 * É a mesma técnica de `isolation-invariants.ts`, que descobre as tabelas com `account_id` por
 * `pg_attribute` em vez de confiar numa constante. Vale a pena repetir o motivo: o dia em que
 * alguém acrescenta uma tabela de negócio e esquece de atualizar a lista é o dia em que o
 * verificador para de verificá-la — em silêncio, e sempre.
 *
 * A ordenação é topológica sobre o grafo de chaves estrangeiras entre essas tabelas. Não é
 * `ON DELETE CASCADE` porque ter ou não cascade é decisão do modelo de dados, e um helper de teste
 * não pode presumi-la — apagar explicitamente funciona com ou sem ela.
 */
async function tenantTablesInDeletionOrder(owner: Client): Promise<string[]> {
  const { rows: tenantTables } = await owner.query<{ table_name: string }>(
    `select c.relname as table_name
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       join pg_attribute a on a.attrelid = c.oid
      where n.nspname = 'public'
        and c.relkind = 'r'
        and a.attname = 'account_id'
        and a.attnum > 0
        and not a.attisdropped`,
  );

  const tables = tenantTables.map((row) => row.table_name);
  // `accounts` não tem coluna `account_id` (ela É a conta), então entra à mão — e por último.
  const names = [...tables, 'accounts'];

  const { rows: edges } = await owner.query<{ child: string; parent: string }>(
    `select child.relname as child, parent.relname as parent
       from pg_constraint fk
       join pg_class child on child.oid = fk.conrelid
       join pg_class parent on parent.oid = fk.confrelid
      where fk.contype = 'f'
        and child.relname = any($1::text[])
        and parent.relname = any($1::text[])
        and child.relname <> parent.relname`,
    [names],
  );

  // Ordenação topológica: uma tabela só pode ser apagada depois de todas as que apontam para ela.
  const dependents = new Map<string, Set<string>>(names.map((name) => [name, new Set()]));
  for (const edge of edges) {
    dependents.get(edge.parent)?.add(edge.child);
  }

  const order: string[] = [];
  const placed = new Set<string>();
  // Passadas sucessivas: a profundidade do grafo é pequena (3 níveis hoje) e o laço termina porque
  // cada passada ou coloca ao menos uma tabela ou não coloca nenhuma — e aí não há mais o que fazer.
  while (order.length < names.length) {
    const ready = names.filter(
      (name) =>
        !placed.has(name) && [...(dependents.get(name) ?? [])].every((child) => placed.has(child)),
    );
    if (ready.length === 0) {
      // Ciclo de chaves estrangeiras. Não existe hoje; se passar a existir, falhar aqui é melhor do
      // que apagar pela metade e deixar o banco em estado que o próximo teste não entende.
      throw new Error(
        `Ciclo de chaves estrangeiras entre as tabelas de tenant: ${names
          .filter((name) => !placed.has(name))
          .join(', ')}`,
      );
    }
    for (const name of ready) {
      order.push(name);
      placed.add(name);
    }
  }

  return order;
}

/** Apaga contas pelo documento, com tudo que pende delas. */
export async function deleteAccountsByDocument(
  owner: Client,
  documents: string[],
): Promise<number> {
  if (documents.length === 0) {
    return 0;
  }

  const { rows } = await owner.query<{ id: string }>(
    'select id from accounts where document = any($1::text[])',
    [documents],
  );
  const ids = rows.map((row) => row.id);
  if (ids.length === 0) {
    return 0;
  }

  for (const table of await tenantTablesInDeletionOrder(owner)) {
    const column = table === 'accounts' ? 'id' : 'account_id';
    // Nome de tabela vem do catálogo do próprio banco, não de entrada externa; os IDs vão
    // parametrizados.
    await owner.query(`delete from ${table} where ${column} = any($1::uuid[])`, [ids]);
  }

  return ids.length;
}

/** Quantas contas existem com estes documentos. Usado para pré-condição e para asserção. */
export async function countAccounts(owner: Client, documents: string[]): Promise<number> {
  const { rows } = await owner.query<{ count: string }>(
    'select count(*)::text as count from accounts where document = any($1::text[])',
    [documents],
  );
  return Number(rows[0].count);
}

/**
 * Apaga toda conta cujo documento NÃO esteja na lista, e devolve os nomes removidas.
 *
 * Existe para um spec só — o do `seed:dev` —, e o motivo é específico. A barreira de dado daquele
 * comando é global por natureza: ele recusa rodar se o banco tiver QUALQUER conta que não seja de
 * demonstração. Testar essa barreira exige controlar o banco inteiro, e não apenas as fixtures do
 * próprio spec.
 *
 * Sem isto, o spec falha por sobra alheia. Aconteceu: uma rodada anterior foi interrompida (SIGTERM
 * por limite de tempo), o `afterAll` dela não rodou, a fixture ficou, e na rodada seguinte o jest —
 * que ordena os arquivos por duração estimada, e portanto muda a ordem entre execuções — pôs o spec
 * do seed antes do que teria limpado a sobra. Quatro testes vermelhos, nenhum defeito de produto.
 * `Ctrl-C` no meio de uma suíte é rotina em desenvolvimento; a suíte não pode depender de nunca
 * acontecer.
 *
 * ⚠️ Devolve os nomes para que o chamador AVISE. Limpar em silêncio esconderia um defeito real de
 * limpeza em outro spec — a sobra deixaria de ser sintoma e passaria a ser rotina.
 */
export async function deleteAccountsExcept(
  owner: Client,
  keepDocuments: string[],
): Promise<string[]> {
  const { rows } = await owner.query<{ name: string; document: string }>(
    'select name, document from accounts where document <> all($1::text[])',
    [keepDocuments],
  );
  if (rows.length === 0) {
    return [];
  }

  await deleteAccountsByDocument(
    owner,
    rows.map((row) => row.document),
  );
  return rows.map((row) => row.name);
}
