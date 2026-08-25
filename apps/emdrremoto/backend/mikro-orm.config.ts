import { defineConfig } from '@mikro-orm/mysql';

// EMDR Remoto mantém MySQL/MariaDB (sem migração de SGBD) — só troca o ORM para MikroORM.
const clientUrl = process.env.DATABASE_URL;
if (!clientUrl) {
  throw new Error('DATABASE_URL is required to run migrations (set it in .env).');
}

export default defineConfig({
  clientUrl,
  connect: true,
  // Limita o pool para operar bem atrás de poolers/limites do provedor (ver playbook Dokploy).
  pool: { min: 0, max: 5 },
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
