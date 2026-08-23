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
import {
  BuildTripWalletCommand,
  BuildTripWalletResult,
  BuildTripWalletUseCase,
} from '../../../../contexts/route/application/use-cases/build-trip-wallet/build-trip-wallet.use-case';
import {
  FieldReceiptResult,
  RegisterFieldReceiptCommand,
  RegisterFieldReceiptUseCase,
} from '../../../../contexts/route/application/use-cases/register-field-receipt/register-field-receipt.use-case';
import {
  EffectuateFieldReceiptCommand,
  EffectuateFieldReceiptResult,
  EffectuateFieldReceiptUseCase,
} from '../../../../contexts/route/application/use-cases/effectuate-field-receipt/effectuate-field-receipt.use-case';
import {
  ReturnConsignedItemsCommand,
  ReturnConsignedItemsResult,
  ReturnConsignedItemsUseCase,
} from '../../../../contexts/route/application/use-cases/return-consigned-items/return-consigned-items.use-case';
import {
  ExchangeConsignedItemsCommand,
  ExchangeConsignedItemsUseCase,
  ExchangeResult,
} from '../../../../contexts/route/application/use-cases/exchange-consigned-items/exchange-consigned-items.use-case';
import { FieldReceiptMethod } from '../../../../contexts/route/domain/entities/field-receipt.entity';
import {
  RegisterTripExpenseCommand,
  RegisterTripExpenseUseCase,
  TripExpenseResult,
} from '../../../../contexts/route/application/use-cases/register-trip-expense/register-trip-expense.use-case';
import {
  CloseTripCommand,
  CloseTripUseCase,
  TripClosureSummary,
} from '../../../../contexts/route/application/use-cases/close-trip/close-trip.use-case';
import {
  GetTripDetailsQuery,
  GetTripDetailsUseCase,
  TripDetailsDto,
} from '../../../../contexts/route/application/use-cases/get-trip-details/get-trip-details.use-case';
import {
  GetTripClosureQuery,
  GetTripClosureUseCase,
} from '../../../../contexts/route/application/use-cases/get-trip-closure/get-trip-closure.use-case';
import { TripExpenseCategory } from '../../../../contexts/route/domain/entities/trip-expense.entity';
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
  EffectuateFieldReceiptRequestDto,
  ExchangeConsignedItemsRequestDto,
  ListTripsQueryDto,
  LoadTripCargoRequestDto,
  RegisterFieldReceiptRequestDto,
  RegisterTripExpenseRequestDto,
  ReturnConsignedItemsRequestDto,
  CloseTripRequestDto,
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
    private readonly buildWallet: BuildTripWalletUseCase,
    private readonly registerReceipt: RegisterFieldReceiptUseCase,
    private readonly effectuateReceipt: EffectuateFieldReceiptUseCase,
    private readonly returnItems: ReturnConsignedItemsUseCase,
    private readonly exchangeItems: ExchangeConsignedItemsUseCase,
    private readonly registerExpense: RegisterTripExpenseUseCase,
    private readonly closeTrip: CloseTripUseCase,
    private readonly getTripDetails: GetTripDetailsUseCase,
    private readonly getTripClosure: GetTripClosureUseCase,
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

  @Get(':id')
  @RequirePermission(PERMISSIONS.rot.read)
  async details(@Param('id', ParseUUIDPipe) id: string): Promise<TripDetailsDto> {
    // Viagem + carteira + recebimentos + despesas numa leitura — a tela do acerto opera sobre isto.
    return this.getTripDetails.execute(new GetTripDetailsQuery(id));
  }

  @Get(':id/closure')
  @RequirePermission(PERMISSIONS.rot.read)
  async closure(@Param('id', ParseUUIDPipe) id: string): Promise<TripClosureSummary> {
    // Batimento de viagem FECHADA — recomputação determinística (auditoria que se relê).
    return this.getTripClosure.execute(new GetTripClosureQuery(id));
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

  // ── Acerto (fatia 4, §3.2/§3.4 do 04) ─────────────────────────────────────────────────────────

  /** Monta a CARTEIRA da viagem (cobrança/recobrança) e aplica a política "perdida". Idempotente. */
  @Post(':id/wallet/build')
  @RequirePermission(PERMISSIONS.rot.trip)
  async wallet(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthTokenPayload,
  ): Promise<BuildTripWalletResult> {
    return this.buildWallet.execute(new BuildTripWalletCommand(actor.accountId, id));
  }

  /** LANÇA um recebimento (proposta — primeiro estágio; nada é baixado aqui). */
  @Post(':id/receipts')
  @HttpCode(201)
  @RequirePermission(PERMISSIONS.rot.trip)
  async addReceipt(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RegisterFieldReceiptRequestDto,
    @CurrentUser() actor: AuthTokenPayload,
  ): Promise<FieldReceiptResult> {
    return this.registerReceipt.execute(
      new RegisterFieldReceiptCommand(actor.accountId, {
        tripId: id,
        titleId: dto.titleId ?? null,
        method: dto.method as FieldReceiptMethod,
        amount: dto.amount,
        interest: dto.interest ?? null,
      }),
    );
  }

  /** EFETIVA um recebimento (segundo estágio — a baixa acontece no FIN aqui). */
  @Post('receipts/:receiptId/effectuate')
  @RequirePermission(PERMISSIONS.rot.trip)
  async effectuate(
    @Param('receiptId', ParseUUIDPipe) receiptId: string,
    @Body() dto: EffectuateFieldReceiptRequestDto,
  ): Promise<EffectuateFieldReceiptResult> {
    return this.effectuateReceipt.execute(
      new EffectuateFieldReceiptCommand(receiptId, dto.financialAccountId),
    );
  }

  /** Devolução do acerto: rep_load → depósito, ao custo da época da carga. */
  @Post(':id/returns')
  @RequirePermission(PERMISSIONS.rot.trip)
  async returns(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReturnConsignedItemsRequestDto,
    @CurrentUser() actor: AuthTokenPayload,
  ): Promise<ReturnConsignedItemsResult> {
    return this.returnItems.execute(
      new ReturnConsignedItemsCommand(
        actor.accountId,
        id,
        dto.toLocationId,
        dto.orderId ?? null,
        dto.lines,
      ),
    );
  }

  /** Troca do acerto: par vinculado exchange_in/exchange_out na carga. */
  @Post(':id/exchanges')
  @RequirePermission(PERMISSIONS.rot.trip)
  async exchanges(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ExchangeConsignedItemsRequestDto,
    @CurrentUser() actor: AuthTokenPayload,
  ): Promise<ExchangeResult> {
    return this.exchangeItems.execute(
      new ExchangeConsignedItemsCommand(
        actor.accountId,
        id,
        dto.orderId ?? null,
        dto.returnedProductId,
        dto.returnedQuantity,
        dto.takenProductId,
        dto.takenQuantity,
      ),
    );
  }

  // ── Fechamento (fatia 5, §3.5/§3.6 do 04) ────────────────────────────────────────────────────

  /** Lança uma despesa diária da viagem (entra no batimento). */
  @Post(':id/expenses')
  @HttpCode(201)
  @RequirePermission(PERMISSIONS.rot.trip)
  async addExpense(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RegisterTripExpenseRequestDto,
    @CurrentUser() actor: AuthTokenPayload,
  ): Promise<TripExpenseResult> {
    return this.registerExpense.execute(
      new RegisterTripExpenseCommand(actor.accountId, {
        tripId: id,
        category: dto.category as TripExpenseCategory,
        amount: dto.amount,
        note: dto.note ?? null,
        spentAt: dto.spentAt ? new Date(dto.spentAt) : null,
      }),
    );
  }

  /**
   * FECHA a viagem (§3.5/§3.6): batimento (cobrança/recobrança/outros/despesas/caixa) + folha de
   * comissões (motor B) → contas a pagar no FIN. A empresa dos títulos vem da VIAGEM.
   */
  @Post(':id/close')
  @RequirePermission(PERMISSIONS.rot.trip)
  async close(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CloseTripRequestDto,
    @CurrentUser() actor: AuthTokenPayload,
  ): Promise<TripClosureSummary> {
    return this.closeTrip.execute(
      new CloseTripCommand(actor.accountId, id, {
        managerUserId: dto.managerUserId ?? null,
        managerPercent: dto.managerPercent ?? null,
        helperAmount: dto.helperAmount ?? null,
      }),
    );
  }
}
