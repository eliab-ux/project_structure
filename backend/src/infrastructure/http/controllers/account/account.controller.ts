import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import {
  GetCurrentAccountQuery,
  GetCurrentAccountUseCase,
} from '../../../../contexts/account/application/use-cases/get-current-account/get-current-account.use-case';
import {
  UpdateAccountCommand,
  UpdateAccountUseCase,
} from '../../../../contexts/account/application/use-cases/update-account/update-account.use-case';
import {
  RequestAccountCancellationCommand,
  RequestAccountCancellationUseCase,
} from '../../../../contexts/account/application/use-cases/request-account-cancellation/request-account-cancellation.use-case';
import { ListPlansUseCase } from '../../../../contexts/plan/application/use-cases/list-plans/list-plans.use-case';
import { AuthTokenPayload } from '../../../../contexts/auth/application/ports/output/token-service.port';
import { PERMISSIONS } from '../../../../contexts/role/domain/permissions.catalog';
import { PermissionGuard } from '../../../security/guards/permission.guard';
import { RequirePermission } from '../../../security/decorators/require-permission.decorator';
import { CurrentUser } from '../../../security/decorators/current-user.decorator';
import { AccountResponseDto } from '../auth/dto/auth-response.dto';

export class UpdateAccountRequestDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name?: string;

  /**
   * IANA timezone. Validated for shape only — the list of valid zones lives in the runtime's ICU
   * data and changes with it, so a hardcoded enum here would reject a legitimate zone after a Node
   * upgrade.
   */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  timezone?: string;
}

export class RequestCancellationRequestDto {
  /** `false` withdraws a pending request. */
  @IsBoolean()
  requested!: boolean;
}

export class PlanResponseDto {
  id!: string;
  code!: string;
  name!: string;
  maxCompanies!: number | null;
  maxUsers!: number | null;
  modules!: string[];
}

export class CurrentAccountResponseDto {
  account!: AccountResponseDto;
  plan!: PlanResponseDto | null;
}

/**
 * The account's own settings.
 *
 * Deliberately narrow: no plan change, no status change, no document change. A tenant lifting its
 * own suspension or upgrading its own plan is an authorization hole no permission string can close
 * — those belong to the operator path.
 */
@Controller('account')
@UseGuards(PermissionGuard)
export class AccountController {
  constructor(
    private readonly getCurrentAccountUseCase: GetCurrentAccountUseCase,
    private readonly updateAccountUseCase: UpdateAccountUseCase,
    private readonly requestCancellationUseCase: RequestAccountCancellationUseCase,
    private readonly listPlansUseCase: ListPlansUseCase,
  ) {}

  @Get()
  @RequirePermission(PERMISSIONS.account.read)
  async current(@CurrentUser() user: AuthTokenPayload): Promise<CurrentAccountResponseDto> {
    const result = await this.getCurrentAccountUseCase.execute(
      new GetCurrentAccountQuery(user.accountId),
    );
    return {
      account: AccountResponseDto.from(result.account),
      plan: result.plan ?? null,
    };
  }

  /** The catalogue, so the settings screen can show what an upgrade would unlock. */
  @Get('plans')
  @RequirePermission(PERMISSIONS.account.read)
  async plans(): Promise<PlanResponseDto[]> {
    return this.listPlansUseCase.execute();
  }

  @Patch()
  @RequirePermission(PERMISSIONS.account.update)
  async update(
    @Body() dto: UpdateAccountRequestDto,
    @CurrentUser() user: AuthTokenPayload,
  ): Promise<AccountResponseDto> {
    const account = await this.updateAccountUseCase.execute(
      new UpdateAccountCommand(user.accountId, dto.name, dto.timezone),
    );
    return AccountResponseDto.from(account);
  }

  /**
   * Step one of cancellation: records the request and keeps the account working so the customer can
   * export everything first (Visão Geral §2.5). Nothing is deleted, and no timer finishes the job —
   * confirming is a separate operator action.
   */
  @Patch('cancellation')
  @RequirePermission(PERMISSIONS.account.update)
  async requestCancellation(
    @Body() dto: RequestCancellationRequestDto,
    @CurrentUser() user: AuthTokenPayload,
  ): Promise<AccountResponseDto> {
    const account = await this.requestCancellationUseCase.execute(
      new RequestAccountCancellationCommand(user.accountId, user.sub, dto.requested),
    );
    return AccountResponseDto.from(account);
  }
}
