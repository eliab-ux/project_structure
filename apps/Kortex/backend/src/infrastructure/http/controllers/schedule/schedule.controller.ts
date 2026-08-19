import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ScheduleUseCases } from '../../../../contexts/schedule/application/use-cases/schedule.use-cases';
import {
  ReservationDto,
  ReservationForModelistaDto,
  ScheduleEntryDto,
  ScheduleEntryWithWarningsDto,
} from '../../../../contexts/schedule/application/dto/schedule.dto';
import {
  NoShowResolution,
  PaymentMethod,
} from '../../../../contexts/schedule/domain/entities/reservation.entity';
import { AuthTokenPayload } from '../../../../contexts/auth/application/ports/output/token-service.port';
import { AdminGuard } from '../../../security/guards/admin.guard';
import { ModelistaGuard } from '../../../security/guards/modelista.guard';
import { JwtAuthGuard } from '../../../security/guards/jwt-auth.guard';
import { CurrentUser } from '../../../security/decorators/current-user.decorator';
import {
  AgendaRangeQueryDto,
  CreateConsultationRequestDto,
  CreateReservationRequestDto,
  MoveMachineHourRequestDto,
  RegisterPaymentRequestDto,
  RescheduleNoShowRequestDto,
  ResolveNoShowRequestDto,
} from './dto/schedule-request.dto';

/**
 * Agenda.
 *
 * A **leitura da grade** é `JwtAuthGuard`: o Modelista vê a agenda da máquina (§5, "Ver agenda da
 * máquina" é ✅ para os três). O `ScheduleEntryDto` não tem campo monetário — o valor vive na
 * reserva, e a reserva tem DTO separado.
 *
 * **Criar atendimento é do Administrativo** (§5) — e criar hora de máquina também, porque hora de
 * máquina é venda.
 */
@Controller('schedule')
export class ScheduleController {
  constructor(private readonly schedule: ScheduleUseCases) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async agenda(
    @CurrentUser() user: AuthTokenPayload,
    @Query() query: AgendaRangeQueryDto,
  ): Promise<ScheduleEntryDto[]> {
    return this.schedule.listAgenda(user.accountId, query.from, query.to);
  }

  /**
   * Atendimento. Pode sobrepor qualquer coisa e devolve `warnings` — o Administrativo decide
   * (regra 6.10).
   */
  @Post('consultations')
  @UseGuards(AdminGuard)
  @HttpCode(201)
  async createConsultation(
    @CurrentUser() user: AuthTokenPayload,
    @Body() dto: CreateConsultationRequestDto,
  ): Promise<ScheduleEntryWithWarningsDto> {
    return this.schedule.createConsultation(user.accountId, dto);
  }

  /** Editar atendimento: horário, título e cliente. Devolve `warnings` como a criação. */
  @Put('consultations/:id')
  @UseGuards(AdminGuard)
  async updateConsultation(
    @CurrentUser() user: AuthTokenPayload,
    @Param('id') id: string,
    @Body() dto: CreateConsultationRequestDto,
  ): Promise<ScheduleEntryWithWarningsDto> {
    return this.schedule.updateConsultation(user.accountId, id, dto);
  }

  /**
   * Mover uma hora de máquina — horário e, quando a reserva permite, máquina.
   *
   * Revalida hora cheia, janela e sobreposição. Reserva paga aceita só mudança de horário: duração
   * e máquina alterariam o total de uma venda já cobrada.
   */
  @Patch('machine-hours/:id')
  @UseGuards(AdminGuard)
  async moveMachineHour(
    @CurrentUser() user: AuthTokenPayload,
    @Param('id') id: string,
    @Body() dto: MoveMachineHourRequestDto,
  ): Promise<ScheduleEntryWithWarningsDto> {
    return this.schedule.moveMachineHour(user.accountId, id, dto);
  }

  @Delete('consultations/:id')
  @UseGuards(AdminGuard)
  @HttpCode(204)
  async removeConsultation(
    @CurrentUser() user: AuthTokenPayload,
    @Param('id') id: string,
  ): Promise<void> {
    await this.schedule.removeConsultation(user.accountId, id);
  }
}

/**
 * Reservas — a venda.
 *
 * `AdminGuard` no controller inteiro: criar, mover, cancelar e registrar pagamento é do
 * Administrativo (§5), e o `ReservationDto` carrega dinheiro. A fila do Modelista tem rota e DTO
 * próprios, abaixo.
 */
@Controller('reservations')
@UseGuards(AdminGuard)
export class ReservationController {
  constructor(private readonly schedule: ScheduleUseCases) {}

  @Get()
  async list(@CurrentUser() user: AuthTokenPayload): Promise<ReservationDto[]> {
    return this.schedule.listReservations(user.accountId);
  }

  @Post()
  @HttpCode(201)
  async create(
    @CurrentUser() user: AuthTokenPayload,
    @Body() dto: CreateReservationRequestDto,
  ): Promise<ReservationDto> {
    // O preço NÃO vem daqui: o use case o busca na máquina escolhida (decisão 2.9).
    return this.schedule.createReservation(user.accountId, dto);
  }

  /**
   * A catraca. É este endpoint que faz a reserva aparecer para o Modelista (regra 2.4) — e, desde
   * a Fase 6, é ele que cria a entrada de caixa, no mesmo ato (§4.15).
   */
  @Patch(':id/payment')
  async registerPayment(
    @CurrentUser() user: AuthTokenPayload,
    @Param('id') id: string,
    @Body() dto: RegisterPaymentRequestDto,
  ): Promise<ReservationDto> {
    return this.schedule.registerPayment(
      user.accountId,
      id,
      dto.method as PaymentMethod,
      user.sub,
      dto.bankAccountId,
    );
  }

  /** Libera o horário para a fila de espera. Ação humana — não existe expiração automática (6.5). */
  @Patch(':id/release')
  async release(
    @CurrentUser() user: AuthTokenPayload,
    @Param('id') id: string,
  ): Promise<ReservationDto> {
    return this.schedule.release(user.accountId, id);
  }

  @Patch(':id/cancel')
  async cancel(
    @CurrentUser() user: AuthTokenPayload,
    @Param('id') id: string,
  ): Promise<ReservationDto> {
    return this.schedule.cancel(user.accountId, id);
  }

  /** Resolver o no-show é exclusivo de `admin`/`owner` (§5). O sistema não decide (regra 6.9). */
  @Patch(':id/no-show/resolution')
  async resolveNoShow(
    @CurrentUser() user: AuthTokenPayload,
    @Param('id') id: string,
    @Body() dto: ResolveNoShowRequestDto,
  ): Promise<ReservationDto> {
    return this.schedule.resolveNoShow(user.accountId, id, dto.resolution as NoShowResolution);
  }

  /**
   * Remarcar: resolve o no-show e cria a reserva nova já paga, num ato só.
   *
   * **Não gera segunda entrada de caixa** (§4.15) — o dinheiro entrou na venda original. Devolve a
   * reserva NOVA; a original fica `no_show` com resolução `rescheduled`.
   */
  @Post(':id/no-show/reschedule')
  @HttpCode(201)
  async rescheduleNoShow(
    @CurrentUser() user: AuthTokenPayload,
    @Param('id') id: string,
    @Body() dto: RescheduleNoShowRequestDto,
  ): Promise<ReservationDto> {
    return this.schedule.rescheduleNoShow(user.accountId, id, dto);
  }
}

/**
 * A fila do Modelista.
 *
 * Duas barreiras independentes contra vazar `pre_reserved` e dinheiro: o repositório só devolve
 * `confirmed`/`in_progress`, e o `ReservationForModelistaDto` não mapeia campo monetário nenhum.
 */
@Controller('modelista/reservations')
@UseGuards(ModelistaGuard)
export class ModelistaReservationController {
  constructor(private readonly schedule: ScheduleUseCases) {}

  @Get()
  async queue(@CurrentUser() user: AuthTokenPayload): Promise<ReservationForModelistaDto[]> {
    return this.schedule.listQueueForModelista(user.accountId);
  }

  /**
   * "Não compareceu" — o Modelista também marca (§5): é ele quem está lá e vê que o cliente não
   * veio. Cria a pendência; quem resolve é o Administrativo (regra 6.9).
   */
  @Patch(':id/no-show')
  async markNoShow(
    @CurrentUser() user: AuthTokenPayload,
    @Param('id') id: string,
  ): Promise<ReservationForModelistaDto> {
    await this.schedule.markNoShow(user.accountId, id);
    // Devolve a fila atualizada em vez do DTO com dinheiro do `markNoShow`.
    const queue = await this.schedule.listQueueForModelista(user.accountId);
    return (
      queue.find((reservation) => reservation.id === id) ??
      ({ id, status: 'no_show' } as ReservationForModelistaDto)
    );
  }
}
