import { ConfigService } from '@nestjs/config';
import { defineConfig } from '@mikro-orm/postgresql';
import { Migrator } from '@mikro-orm/migrations';

/** Uma DATABASE_URL ainda com valor de template — dev consegue subir sem banco de verdade. */
function looksLikePlaceholder(clientUrl: string): boolean {
  return /YOUR_PASSWORD|CHANGE_ME|user:pass@/i.test(clientUrl);
}

export function createMikroOrmConfig(configService: ConfigService) {
  const clientUrl = configService.get<string>('DATABASE_URL');
  const nodeEnv = configService.get<string>('NODE_ENV') ?? 'development';

  if (!clientUrl) {
    throw new Error('DATABASE_URL is required. Set it in apps/Kortex/backend/.env');
  }

  try {
    // eslint-disable-next-line no-new
    new URL(clientUrl);
  } catch {
    throw new Error(
      `Invalid DATABASE_URL.${
        looksLikePlaceholder(clientUrl) ? ' It looks like you are still using a placeholder.' : ''
      }`,
    );
  }

  // Em desenvolvimento com URL de placeholder, conecta preguiçosamente para a aplicação subir
  // (e /api/health responder) sem banco. Produção sempre conecta de imediato.
  const connect = !(nodeEnv === 'development' && looksLikePlaceholder(clientUrl));

  return defineConfig({
    clientUrl,
    connect,
    extensions: [Migrator],
    pool: { min: 0, max: 5, idleTimeoutMillis: 10_000 },
    entities: ['./dist/**/*.entity.js'],
    entitiesTs: ['./src/**/*.entity.ts'],
    // Ainda não há entidade ORM — as tabelas da Fase 1 chegam como migration versionada.
    discovery: { warnWhenNoEntities: false },
    migrations: {
      path: './dist/infrastructure/persistence/mikro-orm/migrations',
      pathTs: './src/infrastructure/persistence/mikro-orm/migrations',
      // Mudança de schema só viaja como migration versionada — nunca schema:update /
      // create_all em produção (CLAUDE.md, regra 8).
      disableForeignKeys: false,
      transactional: true,
    },
    // Timestamp gravado e lido em UTC. O horário de funcionamento da conta é `time` local
    // (account.opens_at / closes_at) e é a agenda que faz a conversão.
    forceUtcTimezone: true,
  });
}
