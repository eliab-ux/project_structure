/**
 * Sincroniza o catálogo de vídeos do YouTube pela linha de comando.
 *
 * Existe porque a sync é `AdminGuard` e não tem botão na UI: num ambiente novo o catálogo está
 * vazio, e sem ele o envio diário não resolve vídeo nenhum. Fazer isso via HTTP exigia criar
 * admin, pegar token e acertar a porta — três chances de errar num terminal de container.
 *
 * Uso:
 *   dev:       npm run catalog:sync
 *   produção:  node dist/scripts/sync-catalog.js
 *
 * Também serve de plano B se a sync automática das 03:00 falhar.
 */
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { MikroORM, RequestContext } from '@mikro-orm/core';
import { AppModule } from '../app.module';
import { SyncCatalogUseCase } from '../contexts/catalog/application/use-cases/sync-catalog/sync-catalog.use-case';

// Em dev as variáveis vêm do .env; no container elas já estão no ambiente.
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('dotenv/config');
} catch {
  // sem .env — segue com process.env
}

async function main(): Promise<void> {
  const logger = new Logger('CatalogSync');

  // Contexto sem servidor HTTP: só o container de DI, para reusar config, repositórios e adapter.
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    // Fora de uma request HTTP não existe contexto do MikroORM, e usar o EntityManager global é
    // proibido (a identity map seria compartilhada). `RequestContext.create` abre um fork
    // dedicado — mesmo mecanismo que o middleware faz em cada request.
    const orm = app.get(MikroORM);
    const result = await RequestContext.create(orm.em, () => app.get(SyncCatalogUseCase).execute());

    logger.log('Sync concluída');
    // eslint-disable-next-line no-console
    console.log(
      [
        '',
        `  leituras importadas : ${result.imported}`,
        `  criadas             : ${result.created}`,
        `  atualizadas         : ${result.updated}`,
        `  descartadas         : ${result.skipped} (sem número de dia ou material complementar)`,
        `  faixa               : dia ${result.firstDay} → ${result.lastDay}`,
        `  números ausentes    : ${result.missingTitleNumbers.join(', ') || 'nenhum'}`,
        `  conflitos de número : ${
          result.conflicts.map((c) => c.titleDayNumber).join(', ') || 'nenhum'
        }`,
        '',
      ].join('\n'),
    );
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(`Falha na sync: ${(error as Error).message}`);
  process.exit(1);
});
