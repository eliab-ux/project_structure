import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { ResellerGuard } from '@infrastructure/security/guards/reseller.guard';
import { AuthTokenPayload } from '@infrastructure/security/ports/token-service.port';
import { RequestWithdrawalUseCase } from '@contexts/withdrawal/application/use-cases/request-withdrawal/request-withdrawal.use-case';
import { RequestWithdrawalCommand } from '@contexts/withdrawal/application/use-cases/request-withdrawal/request-withdrawal.command';
import { ListWithdrawalsUseCase } from '@contexts/withdrawal/application/use-cases/list-withdrawals/list-withdrawals.use-case';
import { ListWithdrawalsQuery } from '@contexts/withdrawal/application/use-cases/list-withdrawals/list-withdrawals.query';
import { RequestWithdrawalRequestDto } from './dto/request-withdrawal.request.dto';
import { BankData } from '@contexts/withdrawal/domain/value-objects/bank-data.vo';

@Controller('withdrawals')
@UseGuards(ResellerGuard)
export class WithdrawalController {
  constructor(
    private readonly requestWithdrawalUseCase: RequestWithdrawalUseCase,
    private readonly listWithdrawalsUseCase: ListWithdrawalsUseCase,
  ) {}

  @Post()
  async request(
    @Body() dto: RequestWithdrawalRequestDto,
    @Request() request: FastifyRequest & { user?: AuthTokenPayload },
  ) {
    const resellerId = request.user?.resellerId;
    if (!resellerId) {
      throw new ForbiddenException('Revendedor inválido');
    }

    const bankData = BankData.create({
      bankName: dto.bankName,
      bankAgency: dto.bankAgency,
      bankAccount: dto.bankAccount,
      bankAccountType: dto.bankAccountType,
      pixKey: dto.pixKey,
    });

    return this.requestWithdrawalUseCase.execute(
      new RequestWithdrawalCommand(resellerId, bankData),
    );
  }

  @Get()
  async list(@Request() request: FastifyRequest & { user?: AuthTokenPayload }) {
    const resellerId = request.user?.resellerId;
    if (!resellerId) {
      throw new ForbiddenException('Revendedor inválido');
    }

    return this.listWithdrawalsUseCase.execute(new ListWithdrawalsQuery(resellerId));
  }
}
