import { BankData } from '../../../domain/value-objects/bank-data.vo';

export class RequestWithdrawalCommand {
  constructor(
    public readonly resellerId: string,
    public readonly bankData: BankData,
  ) {}
}
