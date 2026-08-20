import { Controller, Get, UseGuards } from '@nestjs/common';
import { PreOrderUseCases } from '../../../../contexts/pre-order/application/use-cases/pre-order.use-cases';
import {
  SlotNoticeUseCases,
  WaitingListUseCases,
} from '../../../../contexts/waiting-list/application/use-cases/waiting-list.use-cases';
import { AuthTokenPayload } from '../../../../contexts/auth/application/ports/output/token-service.port';
import { AdminGuard } from '../../../security/guards/admin.guard';
import { CurrentUser } from '../../../security/decorators/current-user.decorator';

/** O que está pendente agora, para os avisos do painel. Só números. */
export class PendingSummaryDto {
  /** Pedidos esperando reserva. */
  preOrders!: number;
  /** Fila de espera por resolver: `waiting` + `offered`. */
  waitingList!: number;
  /** Avisos de vaga do Modelista ainda não tratados — o sino. */
  slotNotices!: number;
}

/**
 * As contagens de pendência do painel, numa requisição só.
 *
 * O menu consulta isto a cada navegação. Três endpoints separados seriam três idas ao banco por
 * troca de tela, o dia inteiro, para desenhar três números — e as três informações são olhadas
 * juntas, no mesmo instante, pela mesma pessoa.
 *
 * É agregação de **camada HTTP**: junta dois serviços de aplicação que já existem, sem criar
 * dependência nova entre os contextos. Nenhum deles passa a conhecer o outro.
 *
 * `AdminGuard`: são as pendências do Administrativo. O Modelista tem a tela dele, e o balão de
 * pedido aberto não diz respeito a ele.
 */
@Controller('pending-summary')
@UseGuards(AdminGuard)
export class PendingController {
  constructor(
    private readonly preOrders: PreOrderUseCases,
    private readonly waitingList: WaitingListUseCases,
    private readonly slotNotices: SlotNoticeUseCases,
  ) {}

  @Get()
  async summary(@CurrentUser() user: AuthTokenPayload): Promise<PendingSummaryDto> {
    // Em paralelo: são três `count` independentes, e serializá-los triplicaria a latência do menu.
    const [preOrders, waitingList, slotNotices] = await Promise.all([
      this.preOrders.countOpen(user.accountId),
      this.waitingList.countPending(user.accountId),
      this.slotNotices.countOpen(user.accountId),
    ]);

    return { preOrders, waitingList, slotNotices };
  }
}
