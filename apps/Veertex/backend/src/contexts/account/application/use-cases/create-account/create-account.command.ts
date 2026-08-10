import { CreateCompanyAddressInput } from '../../../../company/application/use-cases/create-company/create-company.command';

/**
 * Everything an account needs to exist and be usable on the first login.
 *
 * The admin's WhatsApp is required, not optional (CLAUDE.md regra 9) — an account whose only user
 * cannot receive a recovery code is an account that needs database access to rescue.
 */
export class CreateAccountCommand {
  constructor(
    public readonly accountName: string,
    /** CPF or CNPJ of the customer signing up. */
    public readonly accountDocument: string,
    public readonly planCode: string,
    public readonly companyLegalName: string,
    public readonly companyDocument: string,
    public readonly companyTaxRegime: string,
    public readonly companyAddress: CreateCompanyAddressInput,
    public readonly companyStateRegistrationExempt: boolean,
    public readonly adminName: string,
    public readonly adminEmail: string,
    public readonly adminPhone: string,
    public readonly adminPassword: string,
    public readonly companyTradeName?: string | null,
    public readonly companyStateRegistration?: string | null,
    public readonly timezone?: string,
  ) {}
}
