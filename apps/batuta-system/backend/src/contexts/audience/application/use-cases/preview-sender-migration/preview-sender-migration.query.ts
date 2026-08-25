import { MigrationStrategy } from '../../../domain/value-objects/migration-strategy.vo';

export class PreviewSenderMigrationQuery {
  constructor(
    public readonly accountId: string,
    public readonly fromChannelId: string,
    public readonly strategy: MigrationStrategy,
    public readonly toChannelId: string | null,
  ) {}
}
