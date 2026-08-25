import { Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import { PaginatedResult } from '@gitspread/shared-kernel';
import { ListDispatchHistoryUseCase } from '../../../../contexts/dispatch/application/use-cases/list-dispatch-history/list-dispatch-history.use-case';
import { SendNowUseCase } from '../../../../contexts/dispatch/application/use-cases/send-now/send-now.use-case';
import { PaginationQueryDto } from '../../../../shared/http/pagination.query';
import { CurrentUser } from '../../../security/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../security/guards/jwt-auth.guard';
import { AuthTokenPayload } from '../../../security/ports/token-service.port';
import { DispatchLogResponseDto, SendNowResponseDto } from './dto/dispatch-response.dto';

@Controller('dispatch')
@UseGuards(JwtAuthGuard)
export class DispatchController {
  constructor(
    private readonly listHistory: ListDispatchHistoryUseCase,
    private readonly sendNow: SendNowUseCase,
  ) {}

  @Get('history')
  async history(
    @CurrentUser() user: AuthTokenPayload,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResult<DispatchLogResponseDto>> {
    const result = await this.listHistory.execute({
      userId: user.sub,
      page: query.page,
      limit: query.limit,
    });
    return {
      data: result.data.map((log) => DispatchLogResponseDto.fromDto(log)),
      meta: result.meta,
    };
  }

  /** Rate-limited no use case: 3 por hora. Confirmação explícita é responsabilidade da UI. */
  @Post('send-now')
  @HttpCode(200)
  async manualSend(@CurrentUser() user: AuthTokenPayload): Promise<SendNowResponseDto> {
    const result = await this.sendNow.execute({ userId: user.sub });
    return SendNowResponseDto.from(result);
  }
}
