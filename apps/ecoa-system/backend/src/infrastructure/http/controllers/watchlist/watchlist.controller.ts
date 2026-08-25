import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { AddWatchedAccountUseCase } from '../../../../contexts/watchlist/application/use-cases/add-watched-account/add-watched-account.use-case';
import { AddWatchedAccountCommand } from '../../../../contexts/watchlist/application/use-cases/add-watched-account/add-watched-account.command';
import { RemoveWatchedAccountUseCase } from '../../../../contexts/watchlist/application/use-cases/remove-watched-account/remove-watched-account.use-case';
import { RemoveWatchedAccountCommand } from '../../../../contexts/watchlist/application/use-cases/remove-watched-account/remove-watched-account.command';
import { ListWatchlistUseCase } from '../../../../contexts/watchlist/application/use-cases/list-watchlist/list-watchlist.use-case';
import { ListWatchlistQuery } from '../../../../contexts/watchlist/application/use-cases/list-watchlist/list-watchlist.query';
import { JwtAuthGuard } from '../../../security/guards/jwt-auth.guard';
import { CurrentUser } from '../../../security/decorators/current-user.decorator';
import { AuthTokenPayload } from '../../../security/ports/token-service.port';
import { resolveOwnerId } from '../../../../shared/tenant/tenant';
import { AddWatchlistRequestDto } from './dto/watchlist-request.dto';
import { WatchedAccountResponseDto } from './dto/watchlist-response.dto';

@Controller('watchlist')
@UseGuards(JwtAuthGuard)
export class WatchlistController {
  constructor(
    private readonly addWatchedAccountUseCase: AddWatchedAccountUseCase,
    private readonly removeWatchedAccountUseCase: RemoveWatchedAccountUseCase,
    private readonly listWatchlistUseCase: ListWatchlistUseCase,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthTokenPayload): Promise<WatchedAccountResponseDto[]> {
    const ownerId = resolveOwnerId(user);
    const accounts = await this.listWatchlistUseCase.execute(new ListWatchlistQuery(ownerId));
    return accounts.map((account) => WatchedAccountResponseDto.fromDto(account));
  }

  @Post()
  @HttpCode(201)
  async add(
    @CurrentUser() user: AuthTokenPayload,
    @Body() dto: AddWatchlistRequestDto,
  ): Promise<WatchedAccountResponseDto> {
    const ownerId = resolveOwnerId(user);
    const account = await this.addWatchedAccountUseCase.execute(
      new AddWatchedAccountCommand(ownerId, dto.handle),
    );
    return WatchedAccountResponseDto.fromDto(account);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthTokenPayload, @Param('id') id: string): Promise<void> {
    const ownerId = resolveOwnerId(user);
    await this.removeWatchedAccountUseCase.execute(new RemoveWatchedAccountCommand(ownerId, id));
  }
}
