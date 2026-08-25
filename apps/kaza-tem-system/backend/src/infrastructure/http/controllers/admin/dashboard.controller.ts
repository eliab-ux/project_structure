import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminGuard } from '@infrastructure/security/guards/admin.guard';
import { GetAdminMetricsUseCase } from '@contexts/analytics/application/use-cases/get-admin-metrics/get-admin-metrics.use-case';
import { GetAdminMetricsQuery } from '@contexts/analytics/application/use-cases/get-admin-metrics/get-admin-metrics.query';
import { AdminMetricsDto } from '@contexts/analytics/application/dto/admin-metrics.dto';

@Controller('admin/dashboard')
@UseGuards(AdminGuard)
export class AdminDashboardController {
  constructor(private readonly getAdminMetricsUseCase: GetAdminMetricsUseCase) {}

  @Get('metrics')
  async getMetrics(): Promise<AdminMetricsDto> {
    return this.getAdminMetricsUseCase.execute(new GetAdminMetricsQuery());
  }
}
