import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { toCsv } from '../../../domain/services/csv-writer';
import { renderDistributionReportPdf } from '../../../../../infrastructure/reports/distribution-report.pdf';
import {
  DISTRIBUTION_REPORT_SOURCE,
  DistributionReportData,
  DistributionReportSourcePort,
} from '../../ports/output/audit-query.port';
import { DistributionReportNotFoundException } from '../../../domain/exceptions/distribution-report-not-found.exception';
import { ExportDistributionReportCommand } from './export-distribution-report.command';

export class ExportedReportDto {
  fileName!: string;
  mimeType!: string;
  content!: Buffer;
}

/**
 * The exportable report of one distribution (§11 item 2).
 *
 * The spec is unusually emphatic about what this is for: "É o artefato que responde a questionamento
 * externo — requisito de produto, não relatório acessório." So the shape is driven by the question
 * "could a lawyer hand this to someone and have it hold up?", which decides three things:
 *
 *  1. **`rendered_body` verbatim, per recipient.** Not the template, not a reconstruction — the exact
 *     text that went to that person, which is why FASE 6 froze it at planning time (§4).
 *  2. **The approval trail alongside it**: who approved, when, from which IP, and the `content_hash`
 *     they approved. Without the hash the approval refers to "the content", which by then may have
 *     changed; with it, the report states which version was authorised.
 *  3. **Phones masked.** This is a document that leaves the system. A full mobile number per line would
 *     turn an accountability artefact into a mailing list.
 *
 * Two formats because they answer to different readers: CSV for anyone who needs to filter and count,
 * PDF for the version that gets attached to a letter.
 */
@Injectable()
export class ExportDistributionReportUseCase implements UseCase<
  ExportDistributionReportCommand,
  ExportedReportDto
> {
  private readonly logger = new Logger(ExportDistributionReportUseCase.name);

  constructor(
    @Inject(DISTRIBUTION_REPORT_SOURCE) private readonly source: DistributionReportSourcePort,
  ) {}

  async execute(command: ExportDistributionReportCommand): Promise<ExportedReportDto> {
    const data = await this.source.load(command.distributionId);
    if (!data) {
      throw new DistributionReportNotFoundException();
    }

    const dto = new ExportedReportDto();
    const stamp = data.createdAt.toISOString().slice(0, 10);
    const slug = ExportDistributionReportUseCase.slugify(data.contentTitle);

    if (command.format === 'PDF') {
      dto.fileName = `relatorio-${slug}-${stamp}.pdf`;
      dto.mimeType = 'application/pdf';
      dto.content = await renderDistributionReportPdf(data);
    } else {
      dto.fileName = `relatorio-${slug}-${stamp}.csv`;
      dto.mimeType = 'text/csv; charset=utf-8';
      dto.content = Buffer.from(ExportDistributionReportUseCase.buildCsv(data), 'utf-8');
    }

    this.logger.log('Relatório de distribuição exportado', {
      distributionId: data.distributionId,
      format: command.format,
      rows: data.dispatches.length,
    });

    return dto;
  }

  /**
   * One row per recipient, with the header block repeated as leading columns.
   *
   * Flat and denormalised on purpose: a CSV that needs a join to be understood is a CSV nobody can use.
   * Whoever opens this in a spreadsheet can filter by status, sort by time, and read the exact text each
   * person received — without reference to any other file.
   */
  private static buildCsv(data: DistributionReportData): string {
    const approvalSummary = data.approvals
      .map(
        (approval) =>
          `${approval.approverName} (${approval.status}` +
          `${approval.decidedAt ? ` em ${approval.decidedAt.toISOString()}` : ''})`,
      )
      .join(' | ');

    const rows = data.dispatches.map((dispatch) => ({
      distribuicao: data.distributionId,
      conteudo: data.contentTitle,
      classificacao: data.classification,
      content_hash: data.contentHash,
      aprovacoes: approvalSummary,
      contato: dispatch.contactName ?? '',
      telefone: dispatch.contactPhoneMasked,
      canal: dispatch.channelLabel,
      canal_telefone: dispatch.channelPhoneMasked,
      variante: dispatch.variantLabel,
      status: dispatch.status,
      motivo_bloqueio: dispatch.blockedReason ?? '',
      agendado_para: dispatch.scheduledAt?.toISOString() ?? '',
      enviado_em: dispatch.sentAt?.toISOString() ?? '',
      entrega: dispatch.deliveryStatus ?? '',
      erro: dispatch.errorDetail ?? '',
      // Last column on purpose: it is the longest field, and a spreadsheet reads better with it at the
      // end. It is also the one that matters most — the exact text this person received.
      texto_enviado: dispatch.renderedBody,
    }));

    return toCsv(rows);
  }

  private static slugify(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60);
  }
}
