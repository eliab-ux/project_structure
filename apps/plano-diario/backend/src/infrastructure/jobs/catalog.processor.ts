import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { MikroORM, RequestContext } from '@mikro-orm/core';
import { Job } from 'bullmq';
import { SyncCatalogUseCase } from '../../contexts/catalog/application/use-cases/sync-catalog/sync-catalog.use-case';
import { CATALOG_QUEUE, JOB_CATALOG_SYNC } from './jobs.constants';

/**
 * Sync diária do catálogo (03:00). Falha aqui não apaga nada: o catálogo anterior continua
 * válido e o envio do dia seguinte funciona — por isso o envio NÃO depende desta sync.
 */
@Injectable()
@Processor(CATALOG_QUEUE)
export class CatalogProcessor extends WorkerHost {
  private readonly logger = new Logger(CatalogProcessor.name);

  constructor(
    private readonly syncCatalog: SyncCatalogUseCase,
    private readonly orm: MikroORM,
  ) {
    super();
  }

  /** Contexto próprio do MikroORM: job não é request HTTP (ver dispatch.processor.ts). */
  async process(job: Job): Promise<unknown> {
    if (job.name !== JOB_CATALOG_SYNC) {
      return null;
    }
    return RequestContext.create(this.orm.em, async () => {
      const result = await this.syncCatalog.execute();
      this.logger.log('Sync automática do catálogo concluída', {
        imported: result.imported,
        created: result.created,
        updated: result.updated,
      });
      return result;
    });
  }
}
