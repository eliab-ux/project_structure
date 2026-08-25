import { ValueObject } from '@gitspread/domain-primitives';

interface BankDataProps {
  bankName: string;
  bankAgency: string;
  bankAccount: string;
  bankAccountType?: string;
  pixKey?: string;
}

export class BankData extends ValueObject<BankDataProps> {
  private constructor(props: BankDataProps) {
    super(props);
  }

  static create(props: BankDataProps): BankData {
    if (!props.bankName || !props.bankAgency || !props.bankAccount) {
      throw new Error('Bank name, agency and account are required');
    }
    return new BankData(props);
  }

  get bankName(): string {
    return this.props.bankName;
  }

  get bankAgency(): string {
    return this.props.bankAgency;
  }

  get bankAccount(): string {
    return this.props.bankAccount;
  }

  get bankAccountType(): string | undefined {
    return this.props.bankAccountType;
  }

  get pixKey(): string | undefined {
    return this.props.pixKey;
  }
}
