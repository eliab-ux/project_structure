import { Commission } from '../../domain/entities/commission.entity';

export class CommissionDto {
  constructor(
    public readonly id: string,
    public readonly resellerId: string,
    public readonly orderId: string,
    public readonly amount: number,
    public readonly status: string,
    public readonly availableAt: string,
    public readonly createdAt: string,
  ) {}

  static fromDomain(commission: Commission): CommissionDto {
    return new CommissionDto(
      commission.id.value,
      commission.resellerId,
      commission.orderId,
      commission.amount,
      commission.status.value,
      commission.availableAt.toISOString(),
      commission.createdAt.toISOString(),
    );
  }
}

export interface CommissionBalanceDto {
  pending: number;
  available: number;
  withdrawn: number;
  debt: number;
  total: number;
}
