import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { ContentId } from '../../../domain/value-objects/content-id.vo';
import { ContentNotFoundException } from '../../../domain/exceptions/content-not-found.exception';
import { parseMergeFields, renderMergeFields } from '../../../domain/services/merge-fields';
import { ContentPreviewDto, RenderedSampleDto } from '../../dto/content.dto';
import {
  CONTACT_SAMPLE_PROVIDER,
  CONTENT_REPOSITORY,
  ContactSampleProviderPort,
  ContentRepositoryPort,
} from '../../ports/output/content-repository.port';
import { PreviewContentQuery } from './preview-content.query';

/** §7.4 asks for exactly three. */
const SAMPLE_SIZE = 3;

/**
 * Renders the content against REAL contacts (§7.4).
 *
 * The requirement is specific and the reason is good: "amostra real com 3 contatos do público-alvo,
 * incluindo pelo menos um sem `first_name`". A preview built from invented data would show
 * "Olá Maria" forever and the operator would discover "Olá amigo" only after a thousand people saw it.
 *
 * When the audience cannot supply a contact without a first name, the preview says so in `warning`
 * instead of quietly dropping the case the operator most needs to see.
 */
@Injectable()
export class PreviewContentUseCase implements UseCase<PreviewContentQuery, ContentPreviewDto> {
  constructor(
    @Inject(CONTENT_REPOSITORY) private readonly contents: ContentRepositoryPort,
    @Inject(CONTACT_SAMPLE_PROVIDER) private readonly samples: ContactSampleProviderPort,
  ) {}

  async execute(query: PreviewContentQuery): Promise<ContentPreviewDto> {
    const content = await this.contents.findById(ContentId.from(query.contentId));
    if (!content) {
      throw new ContentNotFoundException();
    }

    const contacts = await this.samples.sampleForPreview({
      limit: SAMPLE_SIZE,
      tags: query.tags,
    });

    const dto = new ContentPreviewDto();
    dto.contentId = content.id.value;
    dto.contentHash = content.contentHash;
    dto.mergeFields = parseMergeFields(content.bodyBase).map((field) => ({
      name: field.name,
      fallback: field.fallback,
    }));
    dto.sampledWithoutFirstName = contacts.filter((contact) => contact.firstName === null).length;
    dto.warning = PreviewContentUseCase.buildWarning(contacts.length, dto.sampledWithoutFirstName);

    // Every sendable body — the base and each variant — against every sampled contact, so the
    // operator sees each variant's real wording rather than guessing.
    dto.samples = content.sendableBodies.flatMap((body) =>
      contacts.map<RenderedSampleDto>((contact) => {
        const rendered = renderMergeFields(body.body, { firstName: contact.firstName });
        return {
          variantId: body.variantId,
          variantLabel: body.label,
          contactId: contact.contactId,
          contactPhoneMasked: contact.phoneMasked,
          contactFirstName: contact.firstName,
          renderedBody: rendered.body,
          usedFallback: rendered.usedFallback,
        };
      }),
    );

    return dto;
  }

  private static buildWarning(sampled: number, withoutFirstName: number): string | null {
    if (sampled === 0) {
      return 'Nenhum contato no público para gerar amostra. Importe contatos antes de revisar a prévia.';
    }
    if (sampled < SAMPLE_SIZE) {
      return `Público tem apenas ${sampled} contato(s) — a amostra é menor que os ${SAMPLE_SIZE} pedidos.`;
    }
    if (withoutFirstName === 0) {
      // The fallback is the case that goes wrong in production; not showing it is worth saying out loud.
      return (
        'Nenhum contato da amostra está sem primeiro nome, então o fallback não aparece aqui. ' +
        'Confira a contagem de fallback na prévia da distribuição antes de disparar.'
      );
    }
    return null;
  }
}
