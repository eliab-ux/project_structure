import 'dotenv/config';
import { defineConfig } from '@mikro-orm/postgresql';

/**
 * Config usada apenas pela CLI do MikroORM (migrations/seeders).
 * A aplicação em runtime usa `createMikroOrmConfig` (lê do ConfigService); aqui o `.env`
 * precisa ser carregado à mão porque a CLI não passa pelo ConfigModule do Nest.
 */
const clientUrl = process.env.DATABASE_URL;
if (!clientUrl) {
  throw new Error('DATABASE_URL is required to run migrations (set it in .env).');
}

// O nome do banco vem do path da connection string — hardcodar `dbName` faz o MikroORM
// ignorar a URL e rodar as migrations no banco errado.
const dbName = decodeURIComponent(new URL(clientUrl).pathname.replace(/^\//, '')) || 'postgres';

export default defineConfig({
  dbName,
  clientUrl,
  connect: true,
  // Supabase Session Pooler limita clientes simultâneos — pool pequeno evita EMAXCONNSESSION.
  pool: { min: 0, max: 5, idleTimeoutMillis: 10_000 },
  entities: ['./dist/**/*.entity.js'],
  entitiesTs: ['./src/**/*.entity.ts'],
  // Fase 0 ainda não tem ORM entities — sem isso o discovery falha no boot.
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
