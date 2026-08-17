/**
 * Config exclusiva do CLI (`npm run migration:create|up|down`). A aplicação monta a própria
 * config a partir do ConfigService, em `src/infrastructure/persistence/mikro-orm/config/`.
 *
 * O carregamento do `.env` acontece AQUI e não é suposição: o CLI é um processo Node puro, sem
 * ConfigModule do NestJS. Sem esta linha, `DATABASE_URL` fica indefinida e todo comando de
 * migration falha com "DATABASE_URL is required" enquanto a aplicação conecta normalmente — um
 * par de sintomas que confunde. `override: false` mantém o valor exportado no shell (ou injetado
 * pelo Dokploy) vencendo o do arquivo, que é o que um deploy precisa.
 */
import { config as loadEnv } from 'dotenv';
import { defineConfig } from '@mikro-orm/postgresql';
import { Migrator } from '@mikro-orm/migrations';

loadEnv({ override: false });

const clientUrl = process.env.DATABASE_URL;
if (!clientUrl) {
  throw new Error('DATABASE_URL is required to run migrations (set it in .env).');
}

export default defineConfig({
  clientUrl,
  connect: true,
  extensions: [Migrator],
  pool: { min: 0, max: 5 },
  entities: ['./dist/**/*.entity.js'],
  entitiesTs: ['./src/**/*.entity.ts'],
  // Ainda não existe entidade ORM: as tabelas da Fase 1 chegam como migration versionada
  // (a spec manda schema primeiro, §10). Sem isto o CLI reclama em toda chamada.
  discovery: { warnWhenNoEntities: false },
  migrations: {
    path: './dist/infrastructure/persistence/mikro-orm/migrations',
    pathTs: './src/infrastructure/persistence/mikro-orm/migrations',
  },
  forceUtcTimezone: true,
});
