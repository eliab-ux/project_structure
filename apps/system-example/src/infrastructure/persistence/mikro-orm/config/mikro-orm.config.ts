import { defineConfig } from '@mikro-orm/mssql';
import { Migrator } from '@mikro-orm/migrations';
import { SeedManager } from '@mikro-orm/seeder';

export default defineConfig({
  type: 'mssql',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 1433,
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || '',
  dbName: process.env.DB_NAME || 'gitspread',
  entities: ['./dist/**/*-orm.entity.js'],
  entitiesTs: ['./src/**/*-orm.entity.ts'],
  debug: process.env.DB_LOGGING === 'true',
  migrations: {
    path: './src/infrastructure/persistence/mikro-orm/migrations',
    transactional: true,
    disableForeignKeys: false,
    allOrNothing: true,
    emit: 'ts',
  },
  seeder: {
    path: './src/infrastructure/persistence/mikro-orm/seeders',
    defaultSeeder: 'DatabaseSeeder',
    glob: '!(*.d).{js,ts}',
    emit: 'ts',
  },
  extensions: [Migrator, SeedManager],
  pool: {
    min: 2,
    max: 10,
  },
});
