import { PaginatedResult, PaginationParams } from '@gitspread/shared-kernel';
import { Content } from '../../../domain/entities/content.entity';
import { ContentId } from '../../../domain/value-objects/content-id.vo';
import { ContentClassification } from '../../../domain/value-objects/content-classification.vo';
import { ContentStatus } from '../../../domain/value-objects/content-status.vo';

export const CONTENT_REPOSITORY = Symbol('CONTENT_REPOSITORY');
export const CONTACT_SAMPLE_PROVIDER = Symbol('CONTACT_SAMPLE_PROVIDER');

export interface ListContentsFilter extends PaginationParams {
  status?: ContentStatus;
  classification?: ContentClassification;
  search?: string;
}

/**
 * Saves and loads the WHOLE aggregate — content plus variants plus media.
 *
 * There is deliberately no `saveVariant` or `saveMedia`: a child saved on its own would leave
 * `content_hash` describing something other than what is stored, and §8.5 depends on that hash being
 * exact. One root, one save.
 */
export interface ContentRepositoryPort {
  findById(id: ContentId): Promise<Content | null>;
  list(filter: ListContentsFilter): Promise<PaginatedResult<Content>>;
  save(content: Content): Promise<Content>;
}

/** One contact of the audience, reduced to what a merge-field preview actually needs. */
export interface ContactSample {
  contactId: string;
  /** Null → this sample demonstrates the fallback. */
  firstName: string | null;
  phoneMasked: string;
}

/**
 * Supplies real contacts for the preview (§7.4: "Prévia renderiza amostra real com 3 contatos do
 * público-alvo, incluindo pelo menos um sem `first_name`").
 *
 * A port rather than a direct call into the audience repository: the content context must not depend
 * on the audience context's persistence. The adapter that fulfils it lives in infrastructure.
 *
 * "At least one without first_name" is the contract, not a suggestion — the whole point is showing the
 * fallback in action before anyone dispatches.
 */
export interface ContactSampleProviderPort {
  sampleForPreview(input: { limit: number; tags?: string[] }): Promise<ContactSample[]>;
}
