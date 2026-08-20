import { ConfigService } from '@nestjs/config';
import { defineConfig } from '@mikro-orm/postgresql';
import { Migrator } from '@mikro-orm/migrations';
import { TenantScopeSubscriber } from '../tenant-scope.subscriber';

/**
 * Os únicos esquemas que o driver de Postgres entende. `postgres:` é o apelido histórico e continua
 * em uso em painéis e provedores, então recusá-lo seria recusar um valor correto.
 */
const ESQUEMAS_ACEITOS = ['postgresql:', 'postgres:'];

/** A DATABASE_URL still holding a template value — dev can boot without a real database. */
function looksLikePlaceholder(clientUrl: string): boolean {
  return /CHANGE_ME|YOUR_PASSWORD|user:pass@|<[^>]*>/i.test(clientUrl);
}

/**
 * Diz O QUE está errado na connection string, sem nunca imprimir a senha.
 *
 * Escrito em 20/08/2026, no primeiro deploy, depois de o container morrer com `Invalid DATABASE_URL.`
 * e nada mais. A mensagem estava correta e era inútil: quem a lê no log do Dokploy não tem como
 * saber se faltou o esquema, se sobrou um `<placeholder>` do modelo ou se a senha tem um `@`. São
 * três correções diferentes, e a diferença entre adivinhar e agir é esta função.
 *
 * O valor **não** é ecoado. Cada verificação descreve o formato do erro, não o conteúdo — porque uma
 * connection string num log é a senha do banco num log, e o log do Dokploy é lido por quem tem acesso
 * ao painel, não por quem tem acesso ao banco.
 */
function diagnosticarUrl(clientUrl: string): string {
  /*
   * A ORDEM é por especificidade, e ela importa mais do que parece.
   *
   * "DATABASE_URL=postgresql://…" contém `://` e tem um esquema — cair na checagem de esquema
   * devolveria *"o esquema DATABASE_URL=postgresql: não é de Postgres"*, que é verdade e manda a
   * pessoa procurar a coisa errada. A causa é uma só, e é o nome colado dentro do valor.
   *
   * Descoberto pelo próprio teste desta função, na primeira execução.
   */
  if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(clientUrl)) {
    return ' O valor começa com "NOME=" — o nome da variável foi colado dentro do valor dela.';
  }
  if (/<[^>]*>/.test(clientUrl)) {
    return ' Há um trecho entre < > no valor: um placeholder do modelo não foi substituído.';
  }
  if (/\s/.test(clientUrl)) {
    return ' Há espaço ou quebra de linha no valor. Cole a string numa linha só.';
  }
  if (!clientUrl.includes('://')) {
    return ' Falta o esquema — a string precisa começar com "postgresql://".';
  }
  const esquema = clientUrl.slice(0, clientUrl.indexOf('://') + 1);
  if (!ESQUEMAS_ACEITOS.includes(esquema)) {
    return ` O esquema "${esquema}" não é de Postgres. Use "postgresql://".`;
  }
  // Duas arrobas: o parser usa a ÚLTIMA como separador, então o resto da senha vira parte do host.
  if ((clientUrl.match(/@/g) ?? []).length > 1) {
    return ' Há mais de um "@": se a senha contém um, ele precisa ser escrito como %40.';
  }
  return ' Confira o formato: postgresql://usuario:senha@host:5432/banco.';
}

/**
 * The APPLICATION's ORM config. Connects as `DATABASE_URL` — the RUNTIME role (`veertex_app`),
 * which has no DDL and is subject to RLS. Migrations use a different role and a different config
 * file (`mikro-orm.config.ts` at the package root); mixing the two is what silently disables
 * tenant isolation, because RLS does not apply to the owner of a table.
 */
export function createMikroOrmConfig(configService: ConfigService) {
  const clientUrl = configService.get<string>('DATABASE_URL');
  const nodeEnv = configService.get<string>('NODE_ENV') ?? 'development';

  if (!clientUrl) {
    throw new Error('DATABASE_URL is required. Set it in backend/.env');
  }

  /*
   * Valida em DUAS etapas, e a segunda existe por um defeito achado em 20/08/2026, com teste.
   *
   * `new URL('veertex-veertex-eeilbu:5432/veertex')` **não lança**: o parser lê
   * `veertex-veertex-eeilbu:` como o ESQUEMA e o resto como caminho opaco. Ou seja, colar só
   * `host:porta/banco` — sem `postgresql://` — passava por aqui e ia morrer fundo no driver, com uma
   * mensagem que não menciona a variável de ambiente. Conferir o protocolo é o que fecha isso.
   */
  let parsed: URL;
  try {
    parsed = new URL(clientUrl);
  } catch {
    throw new Error(`DATABASE_URL inválida.${diagnosticarUrl(clientUrl)}`);
  }

  if (!ESQUEMAS_ACEITOS.includes(parsed.protocol)) {
    throw new Error(`DATABASE_URL inválida.${diagnosticarUrl(clientUrl)}`);
  }

  // In development with a placeholder URL, connect lazily so the app still boots (and /api/health
  // still answers) without a database. Production always connects eagerly.
  const connect = !(nodeEnv === 'development' && looksLikePlaceholder(clientUrl));

  return defineConfig({
    clientUrl,
    connect,
    extensions: [Migrator],
    // Self-hosted Postgres. Keep the API pool small and size max_connections as API + workers.
    pool: { min: 0, max: 5, idleTimeoutMillis: 10_000 },
    entities: ['./dist/**/*.entity.js'],
    entitiesTs: ['./src/**/*.entity.ts'],
    // The tenant → database bridge. Registered globally so no code path can opt out of it.
    subscribers: [new TenantScopeSubscriber()],
    migrations: {
      path: './dist/infrastructure/persistence/mikro-orm/migrations',
      pathTs: './src/infrastructure/persistence/mikro-orm/migrations',
      // Schema changes only ever ship as a versioned migration — never schema:update in production.
      transactional: true,
      disableForeignKeys: false,
    },
    // Timestamps are stored/read in UTC; per-account timezone lives in `accounts.timezone`.
    forceUtcTimezone: true,
  });
}
