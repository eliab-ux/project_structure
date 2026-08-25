import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ProcessContactImportUseCase } from '../../../contexts/audience/application/use-cases/process-contact-import/process-contact-import.use-case';
import { ProcessContactImportCommand } from '../../../contexts/audience/application/use-cases/process-contact-import/process-contact-import.command';
import { TenantScopedJobRunner } from '../tenant-scoped-job.runner';
import { QUEUE_CONTACT_IMPORT, ContactImportJobData } from '../queues/queues.constants';

/**
 * Parses an uploaded contact list and creates the contacts (§6.1 item 7: "nunca no request").
 *
 * Runs inside TenantScopedJobRunner, so the tenant comes from the job payload and the default-on
 * tenant filter is satisfied exactly as it is in an HTTP request.
 *
 * `attempts: 1` on the producer side, on purpose: the use case records its own failure on the import
 * row with a message the operator reads, and a retry of a half-finished parse would double-count
 * progress. Re-running is an explicit new import.
 */
@Processor(QUEUE_CONTACT_IMPORT)
export class ContactImportProcessor extends WorkerHost {
  private readonly logger = new Logger(ContactImportProcessor.name);

  constructor(
    private readonly runner: TenantScopedJobRunner,
    private readonly processImport: ProcessContactImportUseCase,
  ) {
    super();
  }

  async process(job: Job<ContactImportJobData>): Promise<void> {
    const { accountId, importId, mapping, hasHeader } = job.data;

    await this.runner.run(accountId, async () => {
      const result = await this.processImport.execute(
        new ProcessContactImportCommand(accountId, importId, mapping, hasHeader),
      );
      this.logger.log('Importação processada', {
        importId,
        status: result.status,
        imported: result.importedCount,
        duplicated: result.duplicatedCount,
        invalid: result.invalidCount,
      });
    });
  }
}
