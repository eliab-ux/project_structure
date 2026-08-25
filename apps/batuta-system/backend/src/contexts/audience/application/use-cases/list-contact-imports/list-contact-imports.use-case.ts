import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { ContactImportDto } from '../../dto/contact.dto';
import {
  CONTACT_IMPORT_REPOSITORY,
  ContactImportRepositoryPort,
} from '../../ports/output/contact-import.ports';

/**
 * Recent imports of the account (§6.1): the history the contacts screen lists so an operator can see
 * what has been loaded, and open the per-line report of anything that was rejected.
 *
 * Capped rather than paginated. An import is an event an operator looks at while it is fresh — the
 * useful question is "what did I just load and what did it reject", never "what did I load in March".
 * The cap is a number and not a silent slice: the screen states it.
 */
const MAX_IMPORTS_RETURNED = 50;

export class ListContactImportsQuery {}

@Injectable()
export class ListContactImportsUseCase implements UseCase<
  ListContactImportsQuery,
  ContactImportDto[]
> {
  constructor(
    @Inject(CONTACT_IMPORT_REPOSITORY) private readonly imports: ContactImportRepositoryPort,
  ) {}

  async execute(_query: ListContactImportsQuery): Promise<ContactImportDto[]> {
    // Tenant-scoped by the global filter — the repository takes no accountId, so there is none to
    // forget or to spoof.
    const recent = await this.imports.listRecent(MAX_IMPORTS_RETURNED);
    return recent.map((contactImport) => ContactImportDto.fromDomain(contactImport));
  }
}
