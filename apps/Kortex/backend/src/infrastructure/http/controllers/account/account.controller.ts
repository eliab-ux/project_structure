import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  GetAccountSettingsUseCase,
  GetAccountSettingsQuery,
} from '../../../../contexts/account/application/use-cases/get-account-settings/get-account-settings.use-case';
import {
  UpdateAccountSettingsUseCase,
  UpdateAccountSettingsCommand,
} from '../../../../contexts/account/application/use-cases/update-account-settings/update-account-settings.use-case';
import {
  ListBusinessHoursUseCase,
  ListBusinessHoursQuery,
} from '../../../../contexts/account/application/use-cases/list-business-hours/list-business-hours.use-case';
import {
  AddBusinessHourUseCase,
  AddBusinessHourCommand,
} from '../../../../contexts/account/application/use-cases/add-business-hour/add-business-hour.use-case';
import {
  RemoveBusinessHourUseCase,
  RemoveBusinessHourCommand,
} from '../../../../contexts/account/application/use-cases/remove-business-hour/remove-business-hour.use-case';
import { AccountSettingsDto } from '../../../../contexts/account/application/dto/account-settings.dto';
import { BusinessHourDto } from '../../../../contexts/account/application/dto/business-hour.dto';
import { AuthTokenPayload } from '../../../../contexts/auth/application/ports/output/token-service.port';
import { AdminGuard } from '../../../security/guards/admin.guard';
import { OwnerGuard } from '../../../security/guards/owner.guard';
import { CurrentUser } from '../../../security/decorators/current-user.decorator';
import {
  AddBusinessHourRequestDto,
  UpdateAccountSettingsRequestDto,
} from './dto/account-request.dto';

/**
 * Configuração da conta. Ler é do Administrativo para cima; **escrever é só do dono** (§5:
 * "Configurar janelas de funcionamento" é exclusivo do `owner`).
 *
 * Em nenhum método a conta vem da URL ou do corpo: sempre `user.accountId`, do token.
 */
@Controller('account')
@UseGuards(AdminGuard)
export class AccountController {
  constructor(
    private readonly getAccountSettingsUseCase: GetAccountSettingsUseCase,
    private readonly updateAccountSettingsUseCase: UpdateAccountSettingsUseCase,
    private readonly listBusinessHoursUseCase: ListBusinessHoursUseCase,
    private readonly addBusinessHourUseCase: AddBusinessHourUseCase,
    private readonly removeBusinessHourUseCase: RemoveBusinessHourUseCase,
  ) {}

  @Get()
  async getSettings(@CurrentUser() user: AuthTokenPayload): Promise<AccountSettingsDto> {
    return this.getAccountSettingsUseCase.execute(new GetAccountSettingsQuery(user.accountId));
  }

  @Put()
  @UseGuards(OwnerGuard)
  async updateSettings(
    @CurrentUser() user: AuthTokenPayload,
    @Body() dto: UpdateAccountSettingsRequestDto,
  ): Promise<AccountSettingsDto> {
    return this.updateAccountSettingsUseCase.execute(
      new UpdateAccountSettingsCommand(
        user.accountId,
        dto.name,
        dto.city,
        dto.timezone,
        dto.reportOwner ?? null,
      ),
    );
  }

  @Get('business-hours')
  async listBusinessHours(@CurrentUser() user: AuthTokenPayload): Promise<BusinessHourDto[]> {
    return this.listBusinessHoursUseCase.execute(new ListBusinessHoursQuery(user.accountId));
  }

  @Post('business-hours')
  @UseGuards(OwnerGuard)
  @HttpCode(201)
  async addBusinessHour(
    @CurrentUser() user: AuthTokenPayload,
    @Body() dto: AddBusinessHourRequestDto,
  ): Promise<BusinessHourDto> {
    return this.addBusinessHourUseCase.execute(
      new AddBusinessHourCommand(user.accountId, dto.weekday, dto.startsAt, dto.endsAt),
    );
  }

  @Delete('business-hours/:id')
  @UseGuards(OwnerGuard)
  @HttpCode(204)
  async removeBusinessHour(
    @CurrentUser() user: AuthTokenPayload,
    @Param('id') id: string,
  ): Promise<void> {
    await this.removeBusinessHourUseCase.execute(new RemoveBusinessHourCommand(user.accountId, id));
  }
}
