import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { SenderMigrationDto } from '../../dto/contact.dto';
import {
  SENDER_MIGRATION_REPOSITORY,
  SenderMigrationRepositoryPort,
} from '../../ports/output/contact-import.ports';

/**
 * History of sender migrations (§6.4).
 *
 * It exists because a migration is irreversible in practice — contacts moved to another chip do not
 * move back by undoing, they move by another migration — so the record of what was moved, by whom and
 * when is the only way to reconstruct why a contact is where it is. The screen offers it next to the
 * button that performs one, on purpose.
 */
const MAX_MIGRATIONS_RETURNED = 50;

export class ListSenderMigrationsQuery {}

@Injectable()
export class ListSenderMigrationsUseCase implements UseCase<
  ListSenderMigrationsQuery,
  SenderMigrationDto[]
> {
  constructor(
    @Inject(SENDER_MIGRATION_REPOSITORY)
    private readonly migrations: SenderMigrationRepositoryPort,
  ) {}

  async execute(_query: ListSenderMigrationsQuery): Promise<SenderMigrationDto[]> {
    const recent = await this.migrations.listRecent(MAX_MIGRATIONS_RETURNED);
    return recent.map((migration) => SenderMigrationDto.fromDomain(migration));
  }
}
