import { WithdrawalDto } from '@contexts/withdrawal/application/dto/withdrawal.dto';

export interface AdminResellerBankInfo {
  bankName: string | null;
  bankCode: string | null;
  bankAgency: string | null;
  bankAccount: string | null;
  bankAccountType: string | null;
  bankHolderName: string | null;
  bankHolderCpf: string | null;
  pixKey: string | null;
  pixKeyType: string | null;
}

export interface AdminResellerSubscriptionInfo {
  status: string;
  amount: number;
  nextBillingDate: Date | null;
}

export interface AdminResellerMetrics {
  totalOrders: number;
  ordersLast30Days: number;
  monthlySales: number;
  balance: {
    pending: number;
    available: number;
    withdrawn: number;
    debt: number;
  };
}

export class AdminResellerDetailDto {
  reseller!: {
    id: string;
    fullName: string;
    cpf: string;
    uniqueLink: string;
    status: string;
    level: string;
    phone: string | null;
    approvedAt: Date | null;
    approvedBy: string | null;
    suspendedAt: Date | null;
    suspensionReason: string | null;
    totalSoldYear: number;
    createdAt: Date;
    updatedAt: Date;
  };
  user!: {
    name: string | null;
    email: string | null;
  };
  bank!: AdminResellerBankInfo;
  subscription!: AdminResellerSubscriptionInfo | null;
  metrics!: AdminResellerMetrics;
  withdrawals!: WithdrawalDto[];

  static fromData(params: {
    resellerId: string;
    fullName: string;
    cpf: string;
    uniqueLink: string;
    status: string;
    level: string;
    phone: string | null;
    approvedAt: Date | null;
    approvedBy: string | null;
    suspendedAt: Date | null;
    suspensionReason: string | null;
    totalSoldYear: number;
    createdAt: Date;
    updatedAt: Date;
    userName: string | null;
    userEmail: string | null;
    bank: AdminResellerBankInfo;
    subscription: AdminResellerSubscriptionInfo | null;
    metrics: AdminResellerMetrics;
    withdrawals: WithdrawalDto[];
  }): AdminResellerDetailDto {
    const dto = new AdminResellerDetailDto();
    dto.reseller = {
      id: params.resellerId,
      fullName: params.fullName,
      cpf: params.cpf,
      uniqueLink: params.uniqueLink,
      status: params.status,
      level: params.level,
      phone: params.phone,
      approvedAt: params.approvedAt,
      approvedBy: params.approvedBy,
      suspendedAt: params.suspendedAt,
      suspensionReason: params.suspensionReason,
      totalSoldYear: params.totalSoldYear,
      createdAt: params.createdAt,
      updatedAt: params.updatedAt,
    };
    dto.user = {
      name: params.userName,
      email: params.userEmail,
    };
    dto.bank = params.bank;
    dto.subscription = params.subscription;
    dto.metrics = params.metrics;
    dto.withdrawals = params.withdrawals;
    return dto;
  }
}
