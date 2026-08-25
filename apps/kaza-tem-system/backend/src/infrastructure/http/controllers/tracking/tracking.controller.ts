import { Body, Controller, Inject, NotFoundException, Post, Req } from '@nestjs/common';
import { RecordVisitRequestDto } from './dto/record-visit.request.dto';
import { RecordVisitUseCase } from '@contexts/analytics/application/use-cases/record-visit/record-visit.use-case';
import { RecordVisitCommand } from '@contexts/analytics/application/use-cases/record-visit/record-visit.command';
import { VisitDto } from '@contexts/analytics/application/dto/visit.dto';
import {
  RESELLER_REPOSITORY,
  ResellerRepositoryPort,
} from '@contexts/reseller/application/ports/output/reseller-repository.port';
import { UniqueLink } from '@contexts/reseller/domain/value-objects/unique-link.vo';
import { FastifyRequest } from 'fastify';

@Controller('tracking')
export class TrackingController {
  constructor(
    private readonly recordVisit: RecordVisitUseCase,
    @Inject(RESELLER_REPOSITORY)
    private readonly resellerRepository: ResellerRepositoryPort,
  ) {}

  @Post('visit')
  async visit(@Body() dto: RecordVisitRequestDto, @Req() req: FastifyRequest): Promise<VisitDto> {
    const uniqueLink = UniqueLink.from(dto.link);
    const reseller = await this.resellerRepository.findByUniqueLink(uniqueLink);

    if (!reseller) {
      throw new NotFoundException('Link de revendedor inválido');
    }

    const forwardedHeader = req.headers['x-forwarded-for'];
    const forwarded =
      typeof forwardedHeader === 'string'
        ? forwardedHeader
        : Array.isArray(forwardedHeader)
          ? forwardedHeader[0]
          : undefined;

    const ipAddress =
      (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : undefined) ??
      req.socket.remoteAddress ??
      undefined;

    const userAgent =
      typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null;

    const referrer = typeof req.headers['referer'] === 'string' ? req.headers['referer'] : null;

    const visit = await this.recordVisit.execute(
      new RecordVisitCommand(
        reseller.id.value,
        dto.visitorId ?? null,
        ipAddress,
        userAgent,
        referrer,
        dto.pageUrl ?? null,
      ),
    );

    return visit;
  }
}
