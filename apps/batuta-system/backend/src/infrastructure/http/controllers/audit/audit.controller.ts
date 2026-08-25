import {
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { PaginatedResult } from '@gitspread/shared-kernel';
import { QueryAuditLogUseCase } from '../../../../contexts/audit/application/use-cases/query-audit-log/query-audit-log.use-case';
import { QueryAuditLogQuery } from '../../../../contexts/audit/application/use-cases/query-audit-log/query-audit-log.query';
import { GetHealthPanelUseCase } from '../../../../contexts/audit/application/use-cases/get-health-panel/get-health-panel.use-case';
import { GetHealthPanelQuery } from '../../../../contexts/audit/application/use-cases/get-health-panel/get-health-panel.query';
import { ExportDistributionReportUseCase } from '../../../../contexts/audit/application/use-cases/export-distribution-report/export-distribution-report.use-case';
import { ExportDistributionReportCommand } from '../../../../contexts/audit/application/use-cases/export-distribution-report/export-distribution-report.command';
import { AuditAction } from '../../../../contexts/audit/domain/value-objects/audit-action.vo';
import { AuthTokenPayload } from '../../../../contexts/auth/application/ports/output/token-service.port';
import { JwtAuthGuard } from '../../../security/guards/jwt-auth.guard';
import { AccountAdminGuard } from '../../../security/guards/account-admin.guard';
import { ClientIp, CurrentUser } from '../../../security/decorators/current-user.decorator';
import {
  ExportReportQueryDto,
  HealthPanelQueryDto,
  QueryAuditQueryDto,
} from './dto/audit-request.dto';
import { AuditLogResponseDto, HealthPanelResponseDto } from './dto/audit-response.dto';

/**
 * Audit, reports and health (FASE 9).
 *
 * The guard split is about what each route reveals:
 *
 *  - **the health panel** is `JwtAuthGuard`: it is the screen an operator checks before starting a
 *    campaign, and hiding it from operators would mean the person doing the sending cannot see whether
 *    the chips are healthy;
 *  - **the audit trail and the export** are `AccountAdminGuard`. The trail names who did what, and the
 *    export is a document containing every message sent to every contact — that is not routine reading.
 */
@Controller('audit')
@UseGuards(JwtAuthGuard)
export class AuditController {
  constructor(
    private readonly queryAuditLog: QueryAuditLogUseCase,
    private readonly getHealthPanel: GetHealthPanelUseCase,
    private readonly exportReport: ExportDistributionReportUseCase,
  ) {}

  /** Sinais de saúde por canal, decisões do throttle com motivo, e o alcance real da conta. */
  @Get('health')
  async health(
    @Query() query: HealthPanelQueryDto,
    @CurrentUser() user: AuthTokenPayload,
  ): Promise<HealthPanelResponseDto> {
    const panel = await this.getHealthPanel.execute(
      new GetHealthPanelQuery(user.accountId, query.windowDays),
    );
    return HealthPanelResponseDto.from(panel);
  }

  @Get('logs')
  @UseGuards(AccountAdminGuard)
  async logs(
    @Query() query: QueryAuditQueryDto,
    @CurrentUser() user: AuthTokenPayload,
  ): Promise<PaginatedResult<AuditLogResponseDto>> {
    const page = await this.queryAuditLog.execute(
      new QueryAuditLogQuery(
        user.accountId,
        query.page,
        query.limit,
        query.action,
        query.actorType,
        query.actorId,
        query.entityType,
        query.entityId,
        query.from ? new Date(query.from) : undefined,
        query.to ? new Date(query.to) : undefined,
      ),
    );
    return { data: page.data.map((log) => AuditLogResponseDto.from(log)), meta: page.meta };
  }

  /** Which actions actually appear in this account's trail, so the filter offers real options. */
  @Get('logs/actions')
  @UseGuards(AccountAdminGuard)
  async actions(@CurrentUser() _user: AuthTokenPayload): Promise<AuditAction[]> {
    return this.queryAuditLog.availableActions();
  }

  /**
   * The exportable report (§11 item 2).
   *
   * Streams a file rather than JSON, so it downloads with a filename instead of being a payload the
   * client has to turn into one. `Content-Disposition` carries the name the use case chose, which
   * includes the content title and the date — a folder of `report.pdf` files is useless.
   */
  @Get('distributions/:id/report')
  @UseGuards(AccountAdminGuard)
  @Header('Cache-Control', 'no-store')
  async report(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ExportReportQueryDto,
    @CurrentUser() user: AuthTokenPayload,
    @ClientIp() ip: string | null,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const exported = await this.exportReport.execute(
      new ExportDistributionReportCommand(user.accountId, user.sub, id, query.format ?? 'CSV', ip),
    );

    reply
      .status(200)
      .header('Content-Type', exported.mimeType)
      .header('Content-Disposition', `attachment; filename="${exported.fileName}"`)
      .send(exported.content);
  }
}
