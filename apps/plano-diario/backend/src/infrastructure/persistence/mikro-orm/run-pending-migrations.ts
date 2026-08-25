import { Logger } from '@nestjs/common';
import { MikroORM } from '@mikro-orm/core';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { isPlaceholderDatabaseUrl } from './config/mikro-orm.config';

/**
 * Aplica as migrations pendentes no start do backend.
 *
 * Por que no boot: em produção (Dokploy) o banco só é alcançável de dentro da rede do
 * servidor, então rodar a CLI exigiria abrir um terminal no container a cada release.
 * Fazendo aqui, um deploy basta — nenhum passo manual, nem agora nem nas próximas migrations.
 * O SQL equivalente segue versionado em `deploy/sql/001_schema.sql` para uso manual.
 *
 * Se falhar, o processo NÃO sobe: um backend sem schema responderia 500 em tudo, e falhar
 * alto no deploy é melhor do que servir uma aplicação quebrada.
 */
export async function runPendingMigrations(app: NestFastifyApplication): Promise<void> {
  const logger = new Logger('Migrations');

  if (process.env.MIGRATIONS_ON_BOOT === 'false') {
    logger.warn('MIGRATIONS_ON_BOOT=false — migrations não serão aplicadas neste start');
    return;
  }

  // Dev sem banco real configurado: não há o que migrar, e o app sobe normalmente.
  if (isPlaceholderDatabaseUrl(process.env.DATABASE_URL)) {
    logger.warn('DATABASE_URL ainda é placeholder — migrations ignoradas');
    return;
  }

  const orm = app.get(MikroORM);
  const migrator = orm.getMigrator();

  try {
    const pending = await migrator.getPendingMigrations();
    if (pending.length === 0) {
      logger.log('Schema já está na última versão');
      return;
    }

    logger.log(
      `Aplicando ${pending.length} migration(s): ${pending.map((m) => m.name).join(', ')}`,
    );
    await migrator.up();
    logger.log('Migrations aplicadas com sucesso');
  } catch (error) {
    logger.error('Falha ao aplicar migrations — o processo será encerrado', {
      // Sem a connection string: ela carrega a senha do banco.
      message: (error as Error)?.message,
    });
    throw error;
  }
}
