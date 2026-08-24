import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  GetCurrentAccountQuery,
  GetCurrentAccountUseCase,
} from '../../../../contexts/account/application/use-cases/get-current-account/get-current-account.use-case';
import {
  UpdateAccountCommand,
  UpdateAccountUseCase,
} from '../../../../contexts/account/application/use-cases/update-account/update-account.use-case';
import {
  UpdateAccountPreferencesCommand,
  UpdateAccountPreferencesUseCase,
} from '../../../../contexts/account/application/use-cases/update-account-preferences/update-account-preferences.use-case';
import {
  RequestAccountCancellationCommand,
  RequestAccountCancellationUseCase,
} from '../../../../contexts/account/application/use-cases/request-account-cancellation/request-account-cancellation.use-case';
import {
  CODE_NUMBERING_MODES,
  CodeNumberingMode,
} from '../../../../contexts/account/domain/value-objects/account-preferences.vo';
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

/**
 * Preferências da conta (§1 do 01A). Tudo opcional: o PATCH sobrepõe só o que veio, e o VO de
 * domínio preenche o resto com o default declarado. Os valores hoje não-implementados
 * (`sequential`, `allowDuplicateDocument = true`) passam pela validação de shape aqui e são recusados
 * com motivo no use case — o DTO valida o QUE é possível dizer, o use case, o que é possível FAZER.
 */
export class UpdateAccountPreferencesRequestDto {
  @IsOptional()
  @IsBoolean()
  allowDuplicateDocument?: boolean;

  @IsOptional()
  @IsIn(CODE_NUMBERING_MODES as unknown as string[])
  contactCodeMode?: string;

  @IsOptional()
  @IsIn(CODE_NUMBERING_MODES as unknown as string[])
  productSkuMode?: string;

  /** Carteirização (§2.3 do 02): liga/desliga a visibilidade de contato por vendedor. */
  @IsOptional()
  @IsBoolean()
  contactCarteirizacao?: boolean;

  /** Estoque negativo permitido (§3.2 do 03). */
  @IsOptional()
  @IsBoolean()
  stockAllowNegative?: boolean;

  @IsOptional()
  @IsBoolean()
  overdueBlockEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  overdueBlockDays?: number;

  @IsOptional()
  @IsIn(['last_day_of_period', 'day_n_next_month'])
  commissionDueRule?: 'last_day_of_period' | 'day_n_next_month';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(28)
  commissionDueDay?: number;
}

export class PlanResponseDto {
  id!: string;
  code!: string;
  name!: string;
  /** Os módulos que o plano permite — o único teto que o plano define (§3.1 do CORE). */
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
    private readonly updateAccountPreferencesUseCase: UpdateAccountPreferencesUseCase,
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
   * The account's preferences (§1 do 01A). `account.update` — a mesma permissão do resto das
   * configurações da conta: quem edita a conta edita as preferências dela.
   */
  @Patch('preferences')
  @RequirePermission(PERMISSIONS.account.update)
  async updatePreferences(
    @Body() dto: UpdateAccountPreferencesRequestDto,
    @CurrentUser() user: AuthTokenPayload,
  ): Promise<AccountResponseDto> {
    const account = await this.updateAccountPreferencesUseCase.execute(
      new UpdateAccountPreferencesCommand(user.accountId, {
        allowDuplicateDocument: dto.allowDuplicateDocument,
        contactCodeMode: dto.contactCodeMode as CodeNumberingMode | undefined,
        productSkuMode: dto.productSkuMode as CodeNumberingMode | undefined,
        contactCarteirizacao: dto.contactCarteirizacao,
        stockAllowNegative: dto.stockAllowNegative,
        overdueBlockEnabled: dto.overdueBlockEnabled,
        overdueBlockDays: dto.overdueBlockDays,
        commissionDueRule: dto.commissionDueRule,
        commissionDueDay: dto.commissionDueDay,
      }),
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
