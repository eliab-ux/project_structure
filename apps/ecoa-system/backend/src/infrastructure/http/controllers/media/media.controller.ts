import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ListOwnMediaUseCase } from '../../../../contexts/content/application/use-cases/list-own-media/list-own-media.use-case';
import { ListOwnMediaQuery } from '../../../../contexts/content/application/use-cases/list-own-media/list-own-media.query';
import { JwtAuthGuard } from '../../../security/guards/jwt-auth.guard';
import { CurrentUser } from '../../../security/decorators/current-user.decorator';
import { AuthTokenPayload } from '../../../security/ports/token-service.port';
import { resolveOwnerId } from '../../../../shared/tenant/tenant';
import { PaginationQueryDto } from '../../../../shared/http/pagination.query';
import { MediaResponseDto } from './dto/media-response.dto';

@Controller('media')
@UseGuards(JwtAuthGuard)
export class MediaController {
  constructor(private readonly listOwnMediaUseCase: ListOwnMediaUseCase) {}

  // Lists the authenticated tenant's own media (owner-scoped, paginated).
  @Get()
  async list(
    @CurrentUser() user: AuthTokenPayload,
    @Query() query: PaginationQueryDto,
  ): Promise<{ items: MediaResponseDto[]; total: number; page: number; limit: number }> {
    const ownerId = resolveOwnerId(user);
    const result = await this.listOwnMediaUseCase.execute(
      new ListOwnMediaQuery(ownerId, query.page, query.limit),
    );
    return {
      items: result.items.map((media) => MediaResponseDto.fromDto(media)),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }
}
