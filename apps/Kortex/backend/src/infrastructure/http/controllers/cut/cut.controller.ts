import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { CutUseCases } from '../../../../contexts/cut/application/use-cases/cut.use-cases';
import {
  CutDto,
  CutWithWarningsDto,
  FabricHistoryDto,
} from '../../../../contexts/cut/application/dto/cut.dto';
import { LAYOUT_TYPES } from '../../../../shared/domain/value-objects/layout-type';
import { AuthTokenPayload } from '../../../../contexts/auth/application/ports/output/token-service.port';
import { ModelistaGuard } from '../../../security/guards/modelista.guard';
import { JwtAuthGuard } from '../../../security/guards/jwt-auth.guard';
import { CurrentUser } from '../../../security/decorators/current-user.decorator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class StartCutRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(trim)
  markerName?: string | null;
}

/**
 * O stop. **`totalPieces` não existe neste DTO** — e a ausência é a regra: ele é
 * `layers × nestedPieces`, calculado no domínio. Não há campo por onde o cliente HTTP o informe.
 */
export class StopCutRequestDto {
  @IsInt()
  @Min(1, { message: 'Informe as camadas confirmadas.' })
  @Max(1000)
  layers!: number;

  @IsInt()
  @Min(1, { message: 'Informe as peças encaixadas.' })
  @Max(10_000)
  nestedPieces!: number;

  @IsIn(LAYOUT_TYPES, { message: `Tipo de enfesto: ${LAYOUT_TYPES.join(', ')}.` })
  layoutType!: string;

  /** Corrigíveis no stop: o Modelista pode descobrir na máquina que o material é outro. */
  @IsOptional()
  @IsUUID('4')
  fabricId?: string | null;

  @IsOptional()
  @IsUUID('4')
  productTypeId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(trim)
  markerName?: string | null;
}

export class FabricHistoryQueryDto {
  @IsUUID('4', { message: 'Informe o tecido.' })
  fabricId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  pieces?: number;
}

/**
 * Apontamento das matrizes — o chão de fábrica.
 *
 * `ModelistaGuard`: start e stop são dele (e do dono). O Administrativo **não aponta corte** — é
 * a segregação de função da §5 em si; se ele pudesse vender e executar, fecharia o ciclo sozinho.
 */
@Controller('reservations/:reservationId/cuts')
@UseGuards(ModelistaGuard)
export class CutController {
  constructor(private readonly cuts: CutUseCases) {}

  @Get()
  async list(
    @CurrentUser() user: AuthTokenPayload,
    @Param('reservationId') reservationId: string,
  ): Promise<CutDto[]> {
    return this.cuts.listByReservation(user.accountId, reservationId);
  }

  /** START — primeiro toque. Recusa com 403 em reserva não paga (regra 2.4). */
  @Post()
  @HttpCode(201)
  async start(
    @CurrentUser() user: AuthTokenPayload,
    @Param('reservationId') reservationId: string,
    @Body() dto: StartCutRequestDto,
  ): Promise<CutDto> {
    return this.cuts.start(user.accountId, reservationId, dto.markerName);
  }

  /** O Modelista encerra a reserva. Depois disso, matriz não é mais editável. */
  @Patch('complete')
  @HttpCode(204)
  async complete(
    @CurrentUser() user: AuthTokenPayload,
    @Param('reservationId') reservationId: string,
  ): Promise<void> {
    await this.cuts.completeReservation(user.accountId, reservationId);
  }
}

@Controller('cuts')
@UseGuards(ModelistaGuard)
export class CutStopController {
  constructor(private readonly cuts: CutUseCases) {}

  /**
   * STOP — segundo e último toque.
   *
   * Camadas acima da altura máxima do tecido voltam em `warnings` e a matriz é gravada assim
   * mesmo: aviso, não bloqueio.
   */
  @Patch(':id/stop')
  async stop(
    @CurrentUser() user: AuthTokenPayload,
    @Param('id') id: string,
    @Body() dto: StopCutRequestDto,
  ): Promise<CutWithWarningsDto> {
    return this.cuts.stop(user.accountId, id, dto);
  }
}

/**
 * Histórico por tecido — o produto secundário do sistema.
 *
 * `JwtAuthGuard`: o Modelista o consome na tela de pré-pedido (é o parâmetro da estimativa) e o
 * Administrativo, para conferir. Não há dinheiro aqui: são camadas, peças e tempo.
 */
@Controller('fabric-history')
@UseGuards(JwtAuthGuard)
export class FabricHistoryController {
  constructor(private readonly cuts: CutUseCases) {}

  @Get()
  async history(
    @CurrentUser() user: AuthTokenPayload,
    @Query() query: FabricHistoryQueryDto,
  ): Promise<FabricHistoryDto> {
    return this.cuts.fabricHistory(user.accountId, query.fabricId, query.pieces ?? null);
  }
}
