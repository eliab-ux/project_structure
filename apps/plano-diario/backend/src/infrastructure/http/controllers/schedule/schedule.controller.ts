import { Body, Controller, Get, Patch, Put, UseGuards } from '@nestjs/common';
import { GetScheduleUseCase } from '../../../../contexts/schedule/application/use-cases/get-schedule/get-schedule.use-case';
import { ToggleScheduleUseCase } from '../../../../contexts/schedule/application/use-cases/toggle-schedule/toggle-schedule.use-case';
import { UpsertScheduleUseCase } from '../../../../contexts/schedule/application/use-cases/upsert-schedule/upsert-schedule.use-case';
import { CurrentUser } from '../../../security/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../security/guards/jwt-auth.guard';
import { AuthTokenPayload } from '../../../security/ports/token-service.port';
import { ToggleScheduleRequestDto, UpsertScheduleRequestDto } from './dto/schedule-request.dto';
import { ScheduleResponseDto } from './dto/schedule-response.dto';

/** Configuração de envio do usuário. `userId` sempre do token, nunca do body. */
@Controller('schedule')
@UseGuards(JwtAuthGuard)
export class ScheduleController {
  constructor(
    private readonly getScheduleUseCase: GetScheduleUseCase,
    private readonly upsertScheduleUseCase: UpsertScheduleUseCase,
    private readonly toggleScheduleUseCase: ToggleScheduleUseCase,
  ) {}

  @Get()
  async get(@CurrentUser() user: AuthTokenPayload): Promise<ScheduleResponseDto> {
    return ScheduleResponseDto.fromDto(await this.getScheduleUseCase.execute({ userId: user.sub }));
  }

  @Put()
  async upsert(
    @CurrentUser() user: AuthTokenPayload,
    @Body() dto: UpsertScheduleRequestDto,
  ): Promise<ScheduleResponseDto> {
    return ScheduleResponseDto.fromDto(
      await this.upsertScheduleUseCase.execute({ userId: user.sub, ...dto }),
    );
  }

  @Patch('toggle')
  async toggle(
    @CurrentUser() user: AuthTokenPayload,
    @Body() dto: ToggleScheduleRequestDto,
  ): Promise<ScheduleResponseDto> {
    return ScheduleResponseDto.fromDto(
      await this.toggleScheduleUseCase.execute({ userId: user.sub, isActive: dto.isActive }),
    );
  }
}
