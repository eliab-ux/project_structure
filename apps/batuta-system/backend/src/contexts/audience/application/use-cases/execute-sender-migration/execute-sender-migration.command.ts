import { MigrationStrategy } from '../../../domain/value-objects/migration-strategy.vo';

export class ExecuteSenderMigrationCommand {
  constructor(
    public readonly accountId: string,
    /** ACCOUNT_ADMIN from the JWT: in v1 the executor IS the recorded approval (6.4 item 4). */
    public readonly performedBy: string,
    public readonly fromChannelId: string,
    public readonly strategy: MigrationStrategy,
    public readonly toChannelId: string | null,
    public readonly ip: string | null,
  ) {}
}
