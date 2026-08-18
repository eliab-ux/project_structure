/**
 * Executor de migrations para o container de produção.
 *
 *   node dist/infrastructure/persistence/mikro-orm/run-migrations.js
 *
 * Existe para que a imagem de runtime **não** precise de `ts-node`, `typescript` nem do CLI do
 * MikroORM. O CLI lê `mikro-orm.config.ts` — um arquivo TypeScript na raiz do backend, que o
 * `nest build` não compila —, então usá-lo em produção obrigaria a arrastar o toolchain de
 * desenvolvimento inteiro para dentro da imagem. Este arquivo é compilado junto com o resto e
 * fala direto com a API do Migrator.
 *
 * **Não roda no start do container.** A escolha está documentada em `apps/Kortex/deploy/README.md`;
 * em uma linha: migration é decisão, não efeito colateral de subir. Ligada ao boot, um redeploy do
 * Dokploy com dois containers vivos ao mesmo tempo dispara duas execuções concorrentes, e uma
 * migration que falha vira crash-loop — o operador vê "aplicação fora do ar" quando o problema é
 * uma coluna.
 *
 * Sai com código 1 em qualquer falha, para o `docker exec` do deploy falhar visivelmente.
 */
import { MikroORM } from '@mikro-orm/postgresql';
import { Migrator } from '@mikro-orm/migrations';

async function main(): Promise<void> {
  const clientUrl = process.env.DATABASE_URL;
  if (!clientUrl) {
    throw new Error('DATABASE_URL é obrigatória para rodar as migrations.');
  }

  const orm = await MikroORM.init({
    clientUrl,
    connect: true,
    extensions: [Migrator],
    // Pool mínimo: este processo vive segundos e não pode competir por conexão com a aplicação
    // que já está no ar.
    pool: { min: 0, max: 2 },
    entities: ['./dist/**/*.entity.js'],
    discovery: { warnWhenNoEntities: false },
    migrations: {
      path: './dist/infrastructure/persistence/mikro-orm/migrations',
      transactional: true,
      disableForeignKeys: false,
    },
    forceUtcTimezone: true,
  });

  try {
    const migrator = orm.getMigrator();
    const pending = await migrator.getPendingMigrations();

    if (pending.length === 0) {
      // eslint-disable-next-line no-console
      console.log('Nenhuma migration pendente.');
      return;
    }

    // eslint-disable-next-line no-console
    console.log(`Aplicando ${pending.length} migration(s):`);
    for (const migration of pending) {
      // eslint-disable-next-line no-console
      console.log(`  - ${migration.name}`);
    }

    await migrator.up();

    // eslint-disable-next-line no-console
    console.log('Migrations aplicadas.');
  } finally {
    await orm.close(true);
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(`❌ Falha ao aplicar migrations: ${(error as Error).message}`);
  process.exit(1);
});
