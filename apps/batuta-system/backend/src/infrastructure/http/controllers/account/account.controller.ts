import { Controller, Get, UseGuards } from '@nestjs/common';
import { GetCurrentAccountUseCase } from '../../../../contexts/account/application/use-cases/get-current-account/get-current-account.use-case';
import { GetCurrentAccountQuery } from '../../../../contexts/account/application/use-cases/get-current-account/get-current-account.query';
import { EnsureAccountCanDispatchUseCase } from '../../../../contexts/account/application/use-cases/ensure-account-can-dispatch/ensure-account-can-dispatch.use-case';
import { EnsureAccountCanDispatchCommand } from '../../../../contexts/account/application/use-cases/ensure-account-can-dispatch/ensure-account-can-dispatch.command';
import { AuthTokenPayload } from '../../../../contexts/auth/application/ports/output/token-service.port';
import { JwtAuthGuard } from '../../../security/guards/jwt-auth.guard';
import { CurrentUser } from '../../../security/decorators/current-user.decorator';
import { AccountResponseDto } from '../auth/dto/auth-response.dto';
import { SendAllowanceResponseDto } from './dto/send-allowance-response.dto';

/** The tenant's own account. Any authenticated user of the account may read it. */
@Controller('account')
@UseGuards(JwtAuthGuard)
export class AccountController {
  constructor(
    private readonly getCurrentAccount: GetCurrentAccountUseCase,
    private readonly ensureCanDispatch: EnsureAccountCanDispatchUseCase,
  ) {}

  @Get()
  async current(@CurrentUser() user: AuthTokenPayload): Promise<AccountResponseDto> {
    const account = await this.getCurrentAccount.execute(
      new GetCurrentAccountQuery(user.accountId),
    );
    return AccountResponseDto.from(account);
  }

  /**
   * How much the account may still send today under its own ceiling. Read-only, and it does not
   * reserve anything: the hard check happens again at planning (FASE 6) and at execution (FASE 7).
   */
  @Get('send-allowance')
  async sendAllowance(@CurrentUser() user: AuthTokenPayload): Promise<SendAllowanceResponseDto> {
    const allowance = await this.ensureCanDispatch.execute(
      new EnsureAccountCanDispatchCommand(user.accountId),
    );
    return SendAllowanceResponseDto.from(allowance);
  }
}
