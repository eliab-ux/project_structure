import { defineConfig } from '@mikro-orm/postgresql';

const clientUrl = process.env.DATABASE_URL;
if (!clientUrl) {
  throw new Error('DATABASE_URL is required to run migrations (set it in .env).');
}

export default defineConfig({
  dbName: 'postgres',
  clientUrl,
  connect: true,
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
