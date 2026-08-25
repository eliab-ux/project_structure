import { defineConfig } from '@mikro-orm/postgresql';

/**
 * Leitor de variáveis de ambiente. Deliberadamente uma função, e não o ConfigService do Nest:
 * assim a config de persistência serve tanto ao módulo (que passa o ConfigService) quanto a
 * scripts de linha de comando (que passam `process.env`), sem arrastar o framework.
 */
export type EnvReader = (key: string) => string | undefined;

/**
 * `true` quando a DATABASE_URL ainda é o exemplo do .env.example. Usado para o app subir em
 * dev sem banco real — e para não tentar migrar um banco que não existe.
 */
export function isPlaceholderDatabaseUrl(clientUrl: string | undefined): boolean {
  if (!clientUrl) {
    return true;
  }
  return clientUrl.includes('YOUR_PASSWORD') || clientUrl.includes('PROJECT_REF');
}

export function createMikroOrmConfig(getEnv: EnvReader) {
  const clientUrl = getEnv('DATABASE_URL');
  const nodeEnv = getEnv('NODE_ENV') ?? 'development';

  if (!clientUrl) {
    throw new Error('DATABASE_URL is required. Set it in apps/plano-diario/backend/.env');
  }

  let dbName: string;
  try {
    // O nome do banco vem da própria connection string. Se `dbName` for hardcodado, o MikroORM
    // usa o valor hardcodado e ignora o path da URL — conectando no banco errado silenciosamente.
    const parsed = new URL(clientUrl);
    dbName = decodeURIComponent(parsed.pathname.replace(/^\//, '')) || 'postgres';
  } catch {
    const hint =
      clientUrl.includes('PROJECT_REF') || clientUrl.includes('YOUR_')
        ? ' It looks like you are still using a placeholder value.'
        : '';
    throw new Error(`Invalid DATABASE_URL.${hint}`);
  }

  // Em dev com placeholder, conecta de forma lazy para o app subir sem banco real.
  const connect = !(nodeEnv === 'development' && isPlaceholderDatabaseUrl(clientUrl));

  return defineConfig({
    dbName,
    clientUrl,
    connect,
    // O Session Pooler do Supabase limita clientes simultâneos (pool_size default 15) e cada
    // cliente em session mode retém uma conexão pelo tempo de vida. Pool pequeno evita
    // "(EMAXCONNSESSION) max clients reached in session mode".
    pool: { min: 0, max: 5, idleTimeoutMillis: 10_000 },
    entities: ['./dist/**/*.entity.js'],
    entitiesTs: ['./src/**/*.entity.ts'],
    // Fase 0 ainda não tem ORM entities — sem isso o discovery aborta o boot.
    discovery: { warnWhenNoEntities: false },
    migrations: {
      path: './dist/infrastructure/persistence/mikro-orm/migrations',
      pathTs: './src/infrastructure/persistence/mikro-orm/migrations',
    },
    seeder: {
      path: './dist/infrastructure/persistence/mikro-orm/seeders',
      pathTs: './src/infrastructure/persistence/mikro-orm/seeders',
      defaultSeeder: 'DatabaseSeeder',
      glob: '!(*.d).{js,ts}',
      emit: 'ts',
    },
  });
}
