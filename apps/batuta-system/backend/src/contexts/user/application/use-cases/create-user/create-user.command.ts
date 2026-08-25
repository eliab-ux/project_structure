import { UserRole } from '../../../domain/value-objects/user-role.vo';

export class CreateUserCommand {
  constructor(
    /** From the JWT of the ACCOUNT_ADMIN performing the action. */
    public readonly accountId: string,
    public readonly performedBy: string,
    public readonly name: string,
    public readonly email: string,
    /** WhatsApp, raw as typed — the PhoneE164 value object normalises it. Required (regra 9). */
    public readonly phone: string,
    public readonly password: string,
    public readonly role: UserRole,
    public readonly ip: string | null,
  ) {}
}
