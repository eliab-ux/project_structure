import { Controller, Get, Request, UseGuards, ForbiddenException } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { ResellerGuard } from '@infrastructure/security/guards/reseller.guard';
import { GetResellerDashboardUseCase } from '@contexts/reseller/application/use-cases/get-dashboard/get-reseller-dashboard.use-case';
import { GetResellerDashboardQuery } from '@contexts/reseller/application/use-cases/get-dashboard/get-reseller-dashboard.query';
import { AuthTokenPayload } from '@infrastructure/security/ports/token-service.port';
import { ResellerDashboardDto } from '@contexts/reseller/application/dto/reseller-dashboard.dto';

@Controller('resellers/dashboard')
@UseGuards(ResellerGuard)
export class ResellerDashboardController {
  constructor(private readonly dashboardUseCase: GetResellerDashboardUseCase) {}

  @Get()
  async get(
    @Request() request: FastifyRequest & { user?: AuthTokenPayload },
  ): Promise<ResellerDashboardDto> {
    const payload = request.user;
    if (!payload?.resellerId) {
      throw new ForbiddenException('Revendedor inválido');
    }

    return this.dashboardUseCase.execute(new GetResellerDashboardQuery(payload.resellerId));
  }
}
