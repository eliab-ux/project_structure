import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { PreOrderUseCases } from '../../../../contexts/pre-order/application/use-cases/pre-order.use-cases';
import { PreOrderDto } from '../../../../contexts/pre-order/application/dto/pre-order.dto';
import {
  SlotNoticeUseCases,
  WaitingListUseCases,
} from '../../../../contexts/waiting-list/application/use-cases/waiting-list.use-cases';
import {
  SlotNoticeDto,
  WaitingListEntryDto,
} from '../../../../contexts/waiting-list/application/dto/waiting-list.dto';
import { AuthTokenPayload } from '../../../../contexts/auth/application/ports/output/token-service.port';
import { AdminGuard } from '../../../security/guards/admin.guard';
import { ModelistaGuard } from '../../../security/guards/modelista.guard';
import { JwtAuthGuard } from '../../../security/guards/jwt-auth.guard';
import { CurrentUser } from '../../../security/decorators/current-user.decorator';
import {
  PreOrderRequestDto,
  SlotNoticeRequestDto,
  WaitingListRequestDto,
} from './dto/pre-order-request.dto';

/**
 * Pré-pedidos — a avaliação do Modelista.
 *
 * Criar e editar é `ModelistaGuard` (§5: modelista ✅, admin ❌, owner ✅); **ler** é do
 * Administrativo para cima, porque é ele quem transforma o pré-pedido em reserva.
 *
 * O Administrativo, portanto, recebe 403 já no guard ao tentar editar — inclusive as horas. E
 * mesmo o `owner`, que passa pelo guard, esbarra na entidade se tentar mexer em
 * `estimated_hours`: definir as horas é exclusivo do Modelista (§4.7).
 */
@Controller('pre-orders')
export class PreOrderController {
  constructor(private readonly preOrders: PreOrderUseCases) {}

  @Get()
  @UseGuards(AdminGuard)
  async list(@CurrentUser() user: AuthTokenPayload): Promise<PreOrderDto[]> {
    // Sem filtro na rota: o painel quer resolver os abertos.
    return this.preOrders.list(user.accountId, ['open']);
  }

  @Get('all')
  @UseGuards(AdminGuard)
  async listAll(@CurrentUser() user: AuthTokenPayload): Promise<PreOrderDto[]> {
    return this.preOrders.list(user.accountId);
  }

  @Get('mine')
  @UseGuards(ModelistaGuard)
  async listMine(@CurrentUser() user: AuthTokenPayload): Promise<PreOrderDto[]> {
    return this.preOrders.listMine(user.accountId, user.sub);
  }

  @Post()
  @UseGuards(ModelistaGuard)
  @HttpCode(201)
  async create(
    @CurrentUser() user: AuthTokenPayload,
    @Body() dto: PreOrderRequestDto,
  ): Promise<PreOrderDto> {
    return this.preOrders.create(user.accountId, user.sub, dto);
  }

  @Put(':id')
  @UseGuards(ModelistaGuard)
  async update(
    @CurrentUser() user: AuthTokenPayload,
    @Param('id') id: string,
    @Body() dto: PreOrderRequestDto,
  ): Promise<PreOrderDto> {
    return this.preOrders.update(user.accountId, user.role, id, dto);
  }

  @Patch(':id/discard')
  @UseGuards(ModelistaGuard)
  async discard(
    @CurrentUser() user: AuthTokenPayload,
    @Param('id') id: string,
  ): Promise<PreOrderDto> {
    return this.preOrders.discard(user.accountId, id);
  }
}

/**
 * Fila de espera.
 *
 * **Leitura para os três papéis, escrita só para o Administrativo** (§4.12 e §5). O Modelista
 * consulta a lista e aciona o Administrativo quando enxerga vaga — e o acionamento é o aviso, não
 * um agendamento.
 */
@Controller('waiting-list')
export class WaitingListController {
  constructor(private readonly waitingList: WaitingListUseCases) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async list(@CurrentUser() user: AuthTokenPayload): Promise<WaitingListEntryDto[]> {
    return this.waitingList.list(user.accountId);
  }

  @Post()
  @UseGuards(AdminGuard)
  @HttpCode(201)
  async create(
    @CurrentUser() user: AuthTokenPayload,
    @Body() dto: WaitingListRequestDto,
  ): Promise<WaitingListEntryDto> {
    return this.waitingList.create(user.accountId, dto);
  }

  @Put(':id')
  @UseGuards(AdminGuard)
  async update(
    @CurrentUser() user: AuthTokenPayload,
    @Param('id') id: string,
    @Body() dto: WaitingListRequestDto,
  ): Promise<WaitingListEntryDto> {
    return this.waitingList.update(user.accountId, id, dto);
  }

  @Patch(':id/offer')
  @UseGuards(AdminGuard)
  async offer(
    @CurrentUser() user: AuthTokenPayload,
    @Param('id') id: string,
  ): Promise<WaitingListEntryDto> {
    return this.waitingList.offer(user.accountId, id);
  }

  @Patch(':id/accept')
  @UseGuards(AdminGuard)
  async accept(
    @CurrentUser() user: AuthTokenPayload,
    @Param('id') id: string,
  ): Promise<WaitingListEntryDto> {
    return this.waitingList.registerAcceptance(user.accountId, id);
  }

  @Patch(':id/drop')
  @UseGuards(AdminGuard)
  async drop(
    @CurrentUser() user: AuthTokenPayload,
    @Param('id') id: string,
  ): Promise<WaitingListEntryDto> {
    return this.waitingList.drop(user.accountId, id);
  }
}

/**
 * O aviso de vaga: "vagou horário, olha a fila".
 *
 * Criar é do Modelista; ler e resolver, do Administrativo. É a única ponta que o Modelista tem
 * sobre a fila, e de propósito — ele **avisa**, o Administrativo escolhe, liga, cobra e registra
 * pago (regra 6.3).
 */
@Controller('slot-notices')
export class SlotNoticeController {
  constructor(private readonly slotNotices: SlotNoticeUseCases) {}

  @Get()
  @UseGuards(AdminGuard)
  async list(@CurrentUser() user: AuthTokenPayload): Promise<SlotNoticeDto[]> {
    return this.slotNotices.list(user.accountId);
  }

  @Post()
  @UseGuards(ModelistaGuard)
  @HttpCode(201)
  async create(
    @CurrentUser() user: AuthTokenPayload,
    @Body() dto: SlotNoticeRequestDto,
  ): Promise<SlotNoticeDto> {
    return this.slotNotices.create(user.accountId, user.sub, dto.note);
  }

  @Patch(':id/handled')
  @UseGuards(AdminGuard)
  async markHandled(
    @CurrentUser() user: AuthTokenPayload,
    @Param('id') id: string,
  ): Promise<SlotNoticeDto> {
    return this.slotNotices.markHandled(user.accountId, id, user.sub);
  }
}
