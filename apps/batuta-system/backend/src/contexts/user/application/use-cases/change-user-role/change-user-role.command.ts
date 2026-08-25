import { UserRole } from '../../../domain/value-objects/user-role.vo';

export class ChangeUserRoleCommand {
  constructor(
    public readonly accountId: string,
    public readonly performedBy: string,
    public readonly userId: string,
    public readonly role: UserRole,
    public readonly ip: string | null,
  ) {}
}
