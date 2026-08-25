import { Body, Controller, Get, Inject, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '@infrastructure/security/guards/admin.guard';
import {
  WithdrawalRepositoryPort,
  WITHDRAWAL_REPOSITORY,
} from '@contexts/withdrawal/application/ports/output/withdrawal-repository.port';
import { ApproveWithdrawalCommand } from '@contexts/withdrawal/application/use-cases/approve-withdrawal/approve-withdrawal.command';
import { ApproveWithdrawalUseCase } from '@contexts/withdrawal/application/use-cases/approve-withdrawal/approve-withdrawal.use-case';
import { RejectWithdrawalCommand } from '@contexts/withdrawal/application/use-cases/reject-withdrawal/reject-withdrawal.command';
import { RejectWithdrawalUseCase } from '@contexts/withdrawal/application/use-cases/reject-withdrawal/reject-withdrawal.use-case';
import { MarkWithdrawalPaidCommand } from '@contexts/withdrawal/application/use-cases/mark-paid/mark-paid.command';
import { MarkWithdrawalPaidUseCase } from '@contexts/withdrawal/application/use-cases/mark-paid/mark-paid.use-case';
import { AdminApproveWithdrawalRequestDto } from './dto/approve-withdrawal.request.dto';
import { AdminRejectWithdrawalRequestDto } from './dto/reject-withdrawal.request.dto';
import { WithdrawalDto } from '@contexts/withdrawal/application/dto/withdrawal.dto';
import { WithdrawalStatusValue } from '@contexts/withdrawal/domain/value-objects/withdrawal-status.vo';

@Controller('admin/withdrawals')
@UseGuards(AdminGuard)
export class AdminWithdrawalController {
  constructor(
    @Inject(WITHDRAWAL_REPOSITORY)
    private readonly withdrawalRepository: WithdrawalRepositoryPort,
    private readonly approveWithdrawalUseCase: ApproveWithdrawalUseCase,
    private readonly rejectWithdrawalUseCase: RejectWithdrawalUseCase,
    private readonly markWithdrawalPaidUseCase: MarkWithdrawalPaidUseCase,
  ) {}

  @Get()
  async list(
    @Query('status') status: WithdrawalStatusValue = 'requested',
  ): Promise<WithdrawalDto[]> {
    const withdrawals = await this.withdrawalRepository.findByStatus(status);
    return withdrawals.map((withdrawal) => WithdrawalDto.fromDomain(withdrawal));
  }

  @Post(':id/approve')
  async approve(
    @Param('id') id: string,
    @Body() dto: AdminApproveWithdrawalRequestDto,
  ): Promise<WithdrawalDto> {
    return this.approveWithdrawalUseCase.execute(new ApproveWithdrawalCommand(id, dto.adminId));
  }

  @Post(':id/reject')
  async reject(
    @Param('id') id: string,
    @Body() dto: AdminRejectWithdrawalRequestDto,
  ): Promise<WithdrawalDto> {
    return this.rejectWithdrawalUseCase.execute(new RejectWithdrawalCommand(id, dto.reason));
  }

  @Post(':id/paid')
  async markAsPaid(@Param('id') id: string): Promise<WithdrawalDto> {
    return this.markWithdrawalPaidUseCase.execute(new MarkWithdrawalPaidCommand(id));
  }
}
