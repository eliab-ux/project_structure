import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { ContactImportNotFoundException } from '../../../domain/exceptions/contact-import-not-found.exception';
import { ContactImportDto } from '../../dto/contact.dto';
import {
  CONTACT_IMPORT_REPOSITORY,
  ContactImportErrorRecord,
  ContactImportRepositoryPort,
} from '../../ports/output/contact-import.ports';
import { GetContactImportQuery } from './get-contact-import.query';

/** Rows of the per-line report returned at once. The COUNT is always exact; this is the detail. */
const MAX_ERRORS_RETURNED = 200;

export class ContactImportReportDto {
  import!: ContactImportDto;
  /** Per-line rejections (§6.1 item 3), so the operator can fix the spreadsheet. */
  errors!: ContactImportErrorRecord[];
  /** True when there are more rejected lines than the ones listed — never a silent cap. */
  errorsTruncated!: boolean;
}

@Injectable()
export class GetContactImportUseCase implements UseCase<
  GetContactImportQuery,
  ContactImportReportDto
> {
  constructor(
    @Inject(CONTACT_IMPORT_REPOSITORY) private readonly imports: ContactImportRepositoryPort,
  ) {}

  async execute(query: GetContactImportQuery): Promise<ContactImportReportDto> {
    const contactImport = await this.imports.findById(query.importId);
    if (!contactImport) {
      throw new ContactImportNotFoundException();
    }

    const errors = await this.imports.listErrors(query.importId, MAX_ERRORS_RETURNED);

    const dto = new ContactImportReportDto();
    dto.import = ContactImportDto.fromDomain(contactImport);
    dto.errors = errors;
    dto.errorsTruncated = contactImport.invalidCount > errors.length;
    return dto;
  }
}
