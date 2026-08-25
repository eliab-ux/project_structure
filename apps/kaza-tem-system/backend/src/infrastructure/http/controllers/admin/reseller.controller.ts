import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { AdminGuard } from '@infrastructure/security/guards/admin.guard';
import { ListPendingResellersQuery } from '@contexts/reseller/application/use-cases/list-pending-resellers/list-pending-resellers.query';
import { ListPendingResellersUseCase } from '@contexts/reseller/application/use-cases/list-pending-resellers/list-pending-resellers.use-case';
import { ListResellersQuery } from '@contexts/reseller/application/use-cases/list-resellers/list-resellers.query';
import { ListResellersUseCase } from '@contexts/reseller/application/use-cases/list-resellers/list-resellers.use-case';
import { RejectResellerCommand } from '@contexts/reseller/application/use-cases/reject-reseller/reject-reseller.command';
import { RejectResellerUseCase } from '@contexts/reseller/application/use-cases/reject-reseller/reject-reseller.use-case';
import { RejectResellerRequestDto } from './dto/reject-reseller.request.dto';
import { SuspendResellerCommand } from '@contexts/reseller/application/use-cases/suspend-reseller/suspend-reseller.command';
import { SuspendResellerUseCase } from '@contexts/reseller/application/use-cases/suspend-reseller/suspend-reseller.use-case';
import { SuspendResellerRequestDto } from './dto/suspend-reseller.request.dto';
import { ReactivateResellerCommand } from '@contexts/reseller/application/use-cases/reactivate-reseller/reactivate-reseller.command';
import { ReactivateResellerUseCase } from '@contexts/reseller/application/use-cases/reactivate-reseller/reactivate-reseller.use-case';
import { ListResellersResult } from '@contexts/reseller/application/use-cases/list-resellers/list-resellers.result';
import { GetAdminResellerDetailQuery } from '@contexts/reseller/application/use-cases/get-admin-reseller-detail/get-admin-reseller-detail.query';
import { GetAdminResellerDetailUseCase } from '@contexts/reseller/application/use-cases/get-admin-reseller-detail/get-admin-reseller-detail.use-case';

type AuthenticatedFastifyRequest = FastifyRequest & {
  user?: {
    sub?: string;
  };
};

const parseNumberParam = (value?: string): number | undefined => {
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
};

@Controller('admin/resellers')
@UseGuards(AdminGuard)
export class AdminResellerController {
  constructor(
    private readonly listPending: ListPendingResellersUseCase,
    private readonly listResellersUseCase: ListResellersUseCase,
    private readonly rejectResellerUseCase: RejectResellerUseCase,
    private readonly suspendResellerUseCase: SuspendResellerUseCase,
    private readonly reactivateResellerUseCase: ReactivateResellerUseCase,
    private readonly adminResellerDetailUseCase: GetAdminResellerDetailUseCase,
  ) {}

  @Get('pending')
  async pending(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    const query = new ListPendingResellersQuery(parseNumberParam(limit), parseNumberParam(offset));
    return this.listPending.execute(query);
  }

  @Get()
  async list(
    @Query('status') status?: string,
    @Query('level') level?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<ListResellersResult> {
    const query = new ListResellersQuery(
      status,
      level,
      search,
      parseNumberParam(limit),
      parseNumberParam(offset),
    );
    return this.listResellersUseCase.execute(query);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  async reject(
    @Param('id') id: string,
    @Body() dto: RejectResellerRequestDto,
    @Request() req: AuthenticatedFastifyRequest,
  ) {
    const userPayload = req.user ?? {};
    if (!userPayload?.sub) {
      throw new Error('Usuário inválido');
    }

    await this.rejectResellerUseCase.execute(
        new RejectResellerCommand(id, userPayload.sub, dto.reason),
      );
  }

  @Post(':id/suspend')
  @HttpCode(HttpStatus.OK)
  async suspend(
    @Param('id') id: string,
    @Body() dto: SuspendResellerRequestDto,
    @Request() req: AuthenticatedFastifyRequest,
  ) {
    const userPayload = req.user ?? {};
    if (!userPayload?.sub) {
      throw new Error('Usuário inválido');
    }

    await this.suspendResellerUseCase.execute(
      new SuspendResellerCommand(id, userPayload.sub, dto.reason),
    );
  }

  @Get(':id')
  async detail(@Param('id') id: string) {
    return this.adminResellerDetailUseCase.execute(new GetAdminResellerDetailQuery(id));
  }

  @Post(':id/reactivate')
  @HttpCode(HttpStatus.OK)
  async reactivate(
    @Param('id') id: string,
    @Request() req: AuthenticatedFastifyRequest,
  ) {
    const userPayload = req.user ?? {};
    if (!userPayload?.sub) {
      throw new Error('Usuário inválido');
    }

    await this.reactivateResellerUseCase.execute(
      new ReactivateResellerCommand(id, userPayload.sub),
    );
  }
}
