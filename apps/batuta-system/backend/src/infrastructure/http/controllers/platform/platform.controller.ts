import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PaginatedResult } from '@gitspread/shared-kernel';
import { PlatformLoginUseCase } from '../../../../contexts/platform/application/use-cases/platform-login/platform-login.use-case';
import { PlatformLoginCommand } from '../../../../contexts/platform/application/use-cases/platform-login/platform-login.command';
import { CreateAccountUseCase } from '../../../../contexts/platform/application/use-cases/create-account/create-account.use-case';
import { CreateAccountCommand } from '../../../../contexts/platform/application/use-cases/create-account/create-account.command';
import { ListAccountsUseCase } from '../../../../contexts/platform/application/use-cases/list-accounts/list-accounts.use-case';
import { ListAccountsQuery } from '../../../../contexts/platform/application/use-cases/list-accounts/list-accounts.query';
import { SuspendAccountUseCase } from '../../../../contexts/platform/application/use-cases/suspend-account/suspend-account.use-case';
import { SuspendAccountCommand } from '../../../../contexts/platform/application/use-cases/suspend-account/suspend-account.command';
import { ReactivateAccountUseCase } from '../../../../contexts/platform/application/use-cases/reactivate-account/reactivate-account.use-case';
import { ReactivateAccountCommand } from '../../../../contexts/platform/application/use-cases/reactivate-account/reactivate-account.command';
import { ChangeDailyCeilingUseCase } from '../../../../contexts/platform/application/use-cases/change-daily-ceiling/change-daily-ceiling.use-case';
import { ChangeDailyCeilingCommand } from '../../../../contexts/platform/application/use-cases/change-daily-ceiling/change-daily-ceiling.command';
import { AssignEvolutionServerUseCase } from '../../../../contexts/platform/application/use-cases/assign-evolution-server/assign-evolution-server.use-case';
import { AssignEvolutionServerCommand } from '../../../../contexts/platform/application/use-cases/assign-evolution-server/assign-evolution-server.command';
import { GetAbuseSignalsUseCase } from '../../../../contexts/platform/application/use-cases/get-abuse-signals/get-abuse-signals.use-case';
import { GetAbuseSignalsQuery } from '../../../../contexts/platform/application/use-cases/get-abuse-signals/get-abuse-signals.query';
import { PlatformAdminGuard } from '../../../security/guards/platform-admin.guard';
import {
  ClientIp,
  CurrentPlatformAdmin,
} from '../../../security/decorators/current-user.decorator';
import { AccountResponseDto, PlatformLoginResponseDto } from '../auth/dto/auth-response.dto';
import { AbuseSignalsResponseDto } from './dto/abuse-signals-response.dto';
import {
  AbuseSignalsQueryDto,
  AssignEvolutionServerRequestDto,
  ChangeDailyCeilingRequestDto,
  CreateAccountRequestDto,
  ListAccountsQueryDto,
  PlatformLoginRequestDto,
  SuspendAccountRequestDto,
} from './dto/platform-request.dto';

/**
 * Platform area. Everything here is behind PlatformAdminGuard, which accepts only a
 * `scope: 'PLATFORM'` token — a tenant token, however privileged inside its own account, is
 * rejected. The login route is the single exception, for the same reason as tenant login.
 */
@Controller('platform')
export class PlatformController {
  constructor(
    private readonly platformLogin: PlatformLoginUseCase,
    private readonly createAccount: CreateAccountUseCase,
    private readonly listAccounts: ListAccountsUseCase,
    private readonly suspendAccount: SuspendAccountUseCase,
    private readonly reactivateAccount: ReactivateAccountUseCase,
    private readonly changeDailyCeiling: ChangeDailyCeilingUseCase,
    private readonly assignEvolutionServer: AssignEvolutionServerUseCase,
    private readonly getAbuseSignals: GetAbuseSignalsUseCase,
  ) {}

  /** PUBLIC — entry point of the platform auth flow. Same opaque-failure treatment as tenant login. */
  @Post('auth/login')
  @HttpCode(200)
  async login(
    @Body() dto: PlatformLoginRequestDto,
    @ClientIp() ip: string | null,
  ): Promise<PlatformLoginResponseDto> {
    const result = await this.platformLogin.execute(
      new PlatformLoginCommand(dto.email, dto.password, ip),
    );
    return PlatformLoginResponseDto.from(result);
  }

  @Get('accounts')
  @UseGuards(PlatformAdminGuard)
  async accounts(
    @Query() query: ListAccountsQueryDto,
  ): Promise<PaginatedResult<AccountResponseDto>> {
    const page = await this.listAccounts.execute(
      new ListAccountsQuery(query.page, query.limit, query.status, query.search),
    );
    return { data: page.data.map((account) => AccountResponseDto.from(account)), meta: page.meta };
  }

  @Post('accounts')
  @HttpCode(201)
  @UseGuards(PlatformAdminGuard)
  async create(
    @Body() dto: CreateAccountRequestDto,
    @CurrentPlatformAdmin() admin: { sub: string },
    @ClientIp() ip: string | null,
  ): Promise<AccountResponseDto> {
    const account = await this.createAccount.execute(
      new CreateAccountCommand(
        dto.name,
        dto.document,
        dto.plan,
        dto.dailySendCeiling,
        dto.timezone,
        dto.adminName,
        dto.adminEmail,
        dto.adminPhone,
        dto.adminPassword,
        admin.sub,
        ip,
      ),
    );
    return AccountResponseDto.from(account);
  }

  @Patch('accounts/:id/suspend')
  @UseGuards(PlatformAdminGuard)
  async suspend(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SuspendAccountRequestDto,
    @CurrentPlatformAdmin() admin: { sub: string },
    @ClientIp() ip: string | null,
  ): Promise<AccountResponseDto> {
    const account = await this.suspendAccount.execute(
      new SuspendAccountCommand(id, dto.reason, admin.sub, ip),
    );
    return AccountResponseDto.from(account);
  }

  @Patch('accounts/:id/reactivate')
  @UseGuards(PlatformAdminGuard)
  async reactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentPlatformAdmin() admin: { sub: string },
    @ClientIp() ip: string | null,
  ): Promise<AccountResponseDto> {
    const account = await this.reactivateAccount.execute(
      new ReactivateAccountCommand(id, admin.sub, ip),
    );
    return AccountResponseDto.from(account);
  }

  /** Platform-only: a tenant must never be able to raise its own ceiling. */
  @Patch('accounts/:id/daily-ceiling')
  @UseGuards(PlatformAdminGuard)
  async ceiling(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeDailyCeilingRequestDto,
    @CurrentPlatformAdmin() admin: { sub: string },
    @ClientIp() ip: string | null,
  ): Promise<AccountResponseDto> {
    const account = await this.changeDailyCeiling.execute(
      new ChangeDailyCeilingCommand(id, dto.dailySendCeiling, admin.sub, ip),
    );
    return AccountResponseDto.from(account);
  }

  /** Moves a tenant to a dedicated Evolution server, or back to the shared one (§14, decisão 7). */
  @Patch('accounts/:id/evolution-server')
  @UseGuards(PlatformAdminGuard)
  async evolutionServer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignEvolutionServerRequestDto,
    @CurrentPlatformAdmin() admin: { sub: string },
    @ClientIp() ip: string | null,
  ): Promise<AccountResponseDto> {
    const account = await this.assignEvolutionServer.execute(
      new AssignEvolutionServerCommand(id, dto.serverUrl, dto.apiKey, admin.sub, ip),
    );
    return AccountResponseDto.from(account);
  }

  @Get('accounts/:id/abuse-signals')
  @UseGuards(PlatformAdminGuard)
  async abuseSignals(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: AbuseSignalsQueryDto,
  ): Promise<AbuseSignalsResponseDto> {
    const signals = await this.getAbuseSignals.execute(
      new GetAbuseSignalsQuery(id, query.from, query.to),
    );
    return AbuseSignalsResponseDto.from(signals);
  }
}
