import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  CreateTripCommand,
  CreateTripUseCase,
} from '../../../../contexts/route/application/use-cases/create-trip/create-trip.use-case';
import {
  ChangeTripStatusCommand,
  ChangeTripStatusUseCase,
} from '../../../../contexts/route/application/use-cases/change-trip-status/change-trip-status.use-case';
import {
  ListTripsQuery,
  ListTripsUseCase,
} from '../../../../contexts/route/application/use-cases/list-trips/list-trips.use-case';
import {
  LoadTripCargoCommand,
  LoadTripCargoUseCase,
} from '../../../../contexts/route/application/use-cases/load-trip-cargo/load-trip-cargo.use-case';
import { TripDto } from '../../../../contexts/route/application/dto/trip.dto';
import { AuthTokenPayload } from '../../../../contexts/auth/application/ports/output/token-service.port';
import { MODULES } from '../../../../contexts/module/domain/modules.catalog';
import { PERMISSIONS } from '../../../../contexts/role/domain/permissions.catalog';
import { ModuleGuard } from '../../../security/guards/module.guard';
import { PermissionGuard } from '../../../security/guards/permission.guard';
import { RequireModule } from '../../../security/decorators/require-module.decorator';
import { RequirePermission } from '../../../security/decorators/require-permission.decorator';
import { CurrentUser } from '../../../security/decorators/current-user.decorator';
import {
  ArriveTripRequestDto,
  CreateTripRequestDto,
  ListTripsQueryDto,
  LoadTripCargoRequestDto,
} from './dto/trip-request.dto';

/**
 * Viagens — ROT (§04), fatia 3: abrir viagem, carga/romaneio, saída/chegada. `@RequireModule(ROT)`;
 * `rot.read` para ver, `rot.trip.manage` para operar (retaguarda — os DOIS ESTÁGIOS do §3.3: o campo
 * lança, o escritório efetiva; o app do campo é fatia futura com autorização própria).
 */
@Controller('trips')
@UseGuards(ModuleGuard, PermissionGuard)
@RequireModule(MODULES.ROT)
export class TripController {
  constructor(
    private readonly createTrip: CreateTripUseCase,
    private readonly changeStatus: ChangeTripStatusUseCase,
    private readonly listTrips: ListTripsUseCase,
    private readonly loadCargo: LoadTripCargoUseCase,
  ) {}

  @Get()
  @RequirePermission(PERMISSIONS.rot.read)
  async list(@Query() query: ListTripsQueryDto): Promise<TripDto[]> {
    return this.listTrips.execute(
      new ListTripsQuery({
        routeId: query.routeId ?? null,
        salesRepId: query.salesRepId ?? null,
        status: query.status ?? null,
      }),
    );
  }

  @Post()
  @HttpCode(201)
  @RequirePermission(PERMISSIONS.rot.trip)
  async create(
    @Body() dto: CreateTripRequestDto,
    @CurrentUser() actor: AuthTokenPayload,
  ): Promise<TripDto> {
    return this.createTrip.execute(
      new CreateTripCommand(actor.accountId, {
        companyId: dto.companyId,
        routeId: dto.routeId,
        salesRepId: dto.salesRepId,
        helperUserId: dto.helperUserId ?? null,
        initialCash: dto.initialCash ?? 0,
        initialKm: dto.initialKm ?? null,
      }),
    );
  }

  @Post(':id/cargo')
  @RequirePermission(PERMISSIONS.rot.trip)
  async cargo(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LoadTripCargoRequestDto,
    @CurrentUser() actor: AuthTokenPayload,
  ): Promise<TripDto> {
    return this.loadCargo.execute(
      new LoadTripCargoCommand(actor.accountId, id, dto.fromLocationId, dto.lines),
    );
  }

  @Post(':id/depart')
  @RequirePermission(PERMISSIONS.rot.trip)
  async depart(@Param('id', ParseUUIDPipe) id: string): Promise<TripDto> {
    return this.changeStatus.execute(new ChangeTripStatusCommand(id, 'depart'));
  }

  @Post(':id/arrive')
  @RequirePermission(PERMISSIONS.rot.trip)
  async arrive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ArriveTripRequestDto,
  ): Promise<TripDto> {
    return this.changeStatus.execute(
      new ChangeTripStatusCommand(id, 'arrive', {
        returnCash: dto.returnCash ?? null,
        finalKm: dto.finalKm ?? null,
      }),
    );
  }

  @Post(':id/cancel')
  @RequirePermission(PERMISSIONS.rot.trip)
  async cancel(@Param('id', ParseUUIDPipe) id: string): Promise<TripDto> {
    return this.changeStatus.execute(new ChangeTripStatusCommand(id, 'cancel'));
  }
}
