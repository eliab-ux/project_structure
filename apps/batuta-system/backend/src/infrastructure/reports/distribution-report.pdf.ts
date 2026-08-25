import PDFDocument from 'pdfkit';
import { DistributionReportData } from '../../contexts/audit/application/ports/output/audit-query.port';

/** A4 in points, with margins wide enough to print and staple. */
const MARGIN = 42;

/**
 * The PDF form of the distribution report (§11 item 2).
 *
 * This is the version that gets attached to a letter, so the layout answers to one question: can someone
 * who was not there reconstruct what happened? Hence the order — what was sent, who authorised it and on
 * which version, then the per-recipient list with the exact text.
 *
 * Two deliberate choices in the layout:
 *
 *  - **The `content_hash` is printed in full**, on the first page. It is what ties the approvals to the
 *    exact wording; abbreviating it to save a line would remove the link between the two halves of the
 *    document.
 *  - **The per-recipient section prints the message text**, not a reference to a template. For a large
 *    campaign that is a long document, and that is correct: the report is evidence, not a summary.
 *
 * The message body is truncated per recipient only past a generous limit, and the truncation is marked —
 * a silently cut message would be worse than a long PDF.
 */
export async function renderDistributionReportPdf(data: DistributionReportData): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: MARGIN, bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));

  const finished = new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });

  // ---- header -----------------------------------------------------------------------------------
  doc.fontSize(16).text('Relatório de distribuição', { align: 'left' });
  doc.moveDown(0.2);
  doc.fontSize(9).fillColor('#555').text(data.accountName);
  doc.fillColor('#000');
  doc.moveDown(0.8);

  line(doc, 'Conteúdo', data.contentTitle);
  line(doc, 'Classificação', data.classification);
  // Printed in full: it is the link between the approvals and the wording.
  line(doc, 'content_hash', data.contentHash);
  line(doc, 'Distribuição', data.distributionId);
  line(doc, 'Status', data.status);
  line(doc, 'Janela', `${fmt(data.windowStart)} até ${fmt(data.windowEnd)}`);
  line(doc, 'Criada por', `${data.createdByName} em ${fmt(data.createdAt)}`);
  line(doc, 'Confirmada em', data.confirmedAt ? fmt(data.confirmedAt) : '—');
  line(doc, 'Concluída em', data.completedAt ? fmt(data.completedAt) : '—');

  doc.moveDown(0.6);
  line(
    doc,
    'Totais',
    `${data.totals.total} destinos · ${data.totals.sent} enviados · ${data.totals.failed} falharam · ` +
      `${data.totals.blocked} bloqueados · ${data.totals.cancelled} cancelados · ${data.totals.pending} pendentes`,
  );

  // ---- approvals --------------------------------------------------------------------------------
  doc.moveDown(1);
  doc.fontSize(12).text('Aprovações');
  doc.moveDown(0.3);
  doc.fontSize(9);

  if (data.approvals.length === 0) {
    doc.fillColor('#a00').text('Nenhuma aprovação registrada para esta distribuição.');
    doc.fillColor('#000');
  } else {
    for (const approval of data.approvals) {
      doc.text(
        `${approval.approverName} — ${approval.status}` +
          `${approval.decidedAt ? ` em ${fmt(approval.decidedAt)}` : ''}` +
          `${approval.decidedIp ? ` (IP ${approval.decidedIp})` : ''}`,
      );
      doc.fillColor('#555').text(`versão aprovada: ${approval.contentHash}`, { indent: 12 });
      if (approval.comment) {
        doc.text(`comentário: ${approval.comment}`, { indent: 12 });
      }
      doc.fillColor('#000').moveDown(0.3);
    }
  }

  // ---- recipients -------------------------------------------------------------------------------
  doc.moveDown(0.8);
  doc.fontSize(12).text(`Destinos (${data.dispatches.length})`);
  doc.moveDown(0.3);
  doc.fontSize(8);

  for (const [index, dispatch] of data.dispatches.entries()) {
    // Keep an entry from being split across pages in the middle of its text.
    if (doc.y > 720) {
      doc.addPage();
    }

    doc
      .fillColor('#000')
      .text(
        `${index + 1}. ${dispatch.contactName ?? 'Sem nome'} — ${dispatch.contactPhoneMasked} · ` +
          `${dispatch.channelLabel} (${dispatch.channelPhoneMasked}) · ${dispatch.variantLabel}`,
      );

    doc
      .fillColor('#555')
      .text(
        `status: ${dispatch.status}` +
          `${dispatch.blockedReason ? ` (${dispatch.blockedReason})` : ''}` +
          `${dispatch.sentAt ? ` · enviado ${fmt(dispatch.sentAt)}` : ''}` +
          `${dispatch.deliveryStatus ? ` · entrega ${dispatch.deliveryStatus}` : ''}` +
          `${dispatch.errorDetail ? ` · erro: ${dispatch.errorDetail}` : ''}`,
        { indent: 12 },
      );

    const body =
      dispatch.renderedBody.length > 1200
        ? `${dispatch.renderedBody.slice(0, 1200)} […texto truncado no relatório]`
        : dispatch.renderedBody;
    doc.fillColor('#000').text(body, { indent: 12 });
    doc.moveDown(0.4);
  }

  // ---- footer on every page ---------------------------------------------------------------------
  const range = doc.bufferedPageRange();
  for (let page = range.start; page < range.start + range.count; page += 1) {
    doc.switchToPage(page);
    doc
      .fontSize(7)
      .fillColor('#777')
      .text(
        `Batuta · relatório gerado em ${fmt(new Date())} · página ${page - range.start + 1} de ${range.count}`,
        MARGIN,
        // Inside the bottom margin, which pdfkit otherwise refuses to draw in.
        doc.page.height - MARGIN + 8,
        { align: 'center', lineBreak: false },
      );
  }

  doc.end();
  return finished;
}

function line(doc: PDFKit.PDFDocument, label: string, value: string): void {
  doc.fontSize(9).fillColor('#555').text(`${label}: `, { continued: true });
  doc.fillColor('#000').text(value);
}

function fmt(date: Date): string {
  // ISO, deliberately: a report that may be read abroad or years later should not depend on a locale.
  return date.toISOString().replace('T', ' ').slice(0, 19);
}
