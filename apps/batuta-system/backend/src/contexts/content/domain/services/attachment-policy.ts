import { Content } from '../entities/content.entity';

/**
 * WhatsApp's caption ceiling for a media message.
 *
 * A text-only message allows far more (the editor caps bodies at 4000), but the moment the text
 * travels as the caption of an image it is subject to this. Nothing warns you: the caption comes back
 * truncated, or the provider rejects the send, and either way the approver signed off on a message
 * nobody received.
 */
export const MAX_CAPTION_LENGTH = 1024;

export interface AttachmentProblem {
  /** Which body it is about — "Base" or the variant label. */
  label: string;
  reason: string;
}

/**
 * Checks that every body of a content still fits in ONE WhatsApp message once its attachment is
 * added (§10: one dispatch is one message).
 *
 * The single-message rule is not a simplification, it is the product: the daily quota counter is
 * incremented once per dispatch and the pacing between sends is the anti-ban core. A content that
 * needed two messages per contact would double the real volume of every campaign while the counter
 * kept reporting half of it — the chip pays for that, not the report.
 *
 * So a content that cannot be sent as one message is refused at planning time, with the reason, and
 * never silently reduced to what fits. Dropping the second attachment or truncating the caption is
 * what makes a campaign go out looking nothing like what was approved.
 */
export function findAttachmentProblems(content: Content): AttachmentProblem[] {
  const problems: AttachmentProblem[] = [];

  for (const sendable of content.sendableBodies) {
    const media = content.mediaFor(sendable.variantId);
    if (media.length === 0) {
      continue;
    }

    if (media.length > 1) {
      problems.push({
        label: sendable.label,
        reason:
          `${media.length} mídias anexadas (${media.map((asset) => asset.originalName).join(', ')}). ` +
          'Cada envio é uma única mensagem do WhatsApp: mídia com o texto como legenda. ' +
          'Deixe uma mídia e crie outro conteúdo para as demais.',
      });
      continue;
    }

    if (sendable.body.length > MAX_CAPTION_LENGTH) {
      problems.push({
        label: sendable.label,
        reason:
          `o texto tem ${sendable.body.length} caracteres e, como legenda de mídia, o limite é ` +
          `${MAX_CAPTION_LENGTH}. Encurte o texto ou remova a mídia.`,
      });
    }
  }

  return problems;
}
