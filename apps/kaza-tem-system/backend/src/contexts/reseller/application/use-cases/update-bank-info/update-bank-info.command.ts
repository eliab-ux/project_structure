export class UpdateResellerBankInfoCommand {
  constructor(
    public readonly resellerId: string,
    public readonly bankName?: string | null,
    public readonly bankCode?: string | null,
    public readonly bankAgency?: string | null,
    public readonly bankAccount?: string | null,
    public readonly bankAccountType?: string | null,
    public readonly bankHolderName?: string | null,
    public readonly bankHolderCpf?: string | null,
    public readonly pixKey?: string | null,
    public readonly pixKeyType?: string | null,
  ) {}
}
