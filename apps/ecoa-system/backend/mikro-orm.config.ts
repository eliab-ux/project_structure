import { defineConfig } from '@mikro-orm/postgresql';

const clientUrl = process.env.DATABASE_URL;
if (!clientUrl) {
  throw new Error('DATABASE_URL is required to run migrations (set it in .env).');
}

// If using the Supabase transaction pooler (port 6543), prepared statements must be
// disabled to avoid statement-cache errors. Direct connection (5432) has no such issue.
const usesTransactionPooler = clientUrl.includes(':6543');

export default defineConfig({
  dbName: 'postgres',
  clientUrl,
  connect: true,
  driverOptions: usesTransactionPooler
    ? { connection: { statement_timeout: 0 } }
    : undefined,
  // MikroORM 6: disable prepared statements when behind the transaction pooler.
  preferReadReplicas: false,
  entities: ['./dist/**/*.entity.js'],
  entitiesTs: ['./src/**/*.entity.ts'],
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
