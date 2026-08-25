import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  ContactSample,
  ContactSampleProviderPort,
} from '../../contexts/content/application/ports/output/content-repository.port';
import {
  CONTACT_REPOSITORY,
  ContactRepositoryPort,
} from '../../contexts/audience/application/ports/output/contact-repository.port';

/**
 * Supplies real contacts for the content preview (§7.4).
 *
 * The interesting part is the deliberate bias: the sample must include AT LEAST ONE contact without a
 * first name, because that is the case that goes wrong in production ("Olá , tudo bem?") and the one
 * an operator never thinks to check. So it asks for contacts without a first name FIRST, then fills the
 * rest with named ones — rather than taking the first three rows and hoping.
 *
 * This adapter is the seam between two contexts: content needs audience data, and it gets it through a
 * port rather than by importing the audience repository into the content use case.
 */
@Injectable()
export class ContactSampleAdapter implements ContactSampleProviderPort {
  private readonly logger = new Logger(ContactSampleAdapter.name);

  constructor(@Inject(CONTACT_REPOSITORY) private readonly contacts: ContactRepositoryPort) {}

  async sampleForPreview(input: { limit: number; tags?: string[] }): Promise<ContactSample[]> {
    const limit = Math.max(1, Math.min(input.limit, 10));

    // Page 1 of routable contacts, biased so the fallback case shows up. `list` is tenant-scoped by
    // the global filter, so this can only ever see the current account's people.
    const page = await this.contacts.list({
      page: 1,
      // Over-fetch a little: we need to pick across two buckets, not take the first N.
      limit: limit * 10,
      tags: input.tags,
      active: true,
      optedOut: false,
    });

    const withoutFirstName = page.data.filter((contact) => contact.firstName === null);
    const withFirstName = page.data.filter((contact) => contact.firstName !== null);

    const chosen = [
      // At least one, and never more than half the sample: the preview should look mostly normal.
      ...withoutFirstName.slice(0, Math.max(1, Math.floor(limit / 3))),
      ...withFirstName,
    ].slice(0, limit);

    if (withoutFirstName.length === 0) {
      this.logger.debug(
        'Amostra sem contato sem primeiro nome — o fallback não aparecerá na prévia',
      );
    }

    return chosen.map<ContactSample>((contact) => ({
      contactId: contact.id.value,
      firstName: contact.firstName,
      // Masked: a preview screen is not a place to expose numbers.
      phoneMasked: contact.phone.masked,
    }));
  }
}
