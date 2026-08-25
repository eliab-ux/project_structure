import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { WhatsappGroup } from '../../../domain/entities/whatsapp-group.entity';
import { WhatsappInstanceNotFoundException } from '../../../domain/exceptions/whatsapp-instance-not-found.exception';
import { WhatsappNotConnectedException } from '../../../domain/exceptions/whatsapp-not-connected.exception';
import { GroupJid } from '../../../domain/value-objects/group-jid.vo';
import { GroupListDto } from '../../dto/whatsapp-group.dto';
import { WHATSAPP_GATEWAY, WhatsappGatewayPort } from '../../ports/output/whatsapp-gateway.port';
import {
  WHATSAPP_GROUP_REPOSITORY,
  WhatsappGroupRepositoryPort,
} from '../../ports/output/whatsapp-group-repository.port';
import {
  WHATSAPP_INSTANCE_REPOSITORY,
  WhatsappInstanceRepositoryPort,
} from '../../ports/output/whatsapp-instance-repository.port';

/**
 * Busca os grupos no WhatsApp conectado e substitui o cache do usuário.
 *
 * Substitui em vez de só inserir: se o usuário saiu de um grupo, ele precisa desaparecer da
 * lista de destinos. O agendamento não fica órfão por isso — ele guarda um snapshot do nome
 * do grupo (spec §4.5) justamente para continuar exibível.
 */
@Injectable()
export class SyncGroupsUseCase implements UseCase<{ userId: string }, GroupListDto> {
  private readonly logger = new Logger(SyncGroupsUseCase.name);

  constructor(
    @Inject(WHATSAPP_INSTANCE_REPOSITORY)
    private readonly instances: WhatsappInstanceRepositoryPort,
    @Inject(WHATSAPP_GROUP_REPOSITORY)
    private readonly groups: WhatsappGroupRepositoryPort,
    @Inject(WHATSAPP_GATEWAY) private readonly gateway: WhatsappGatewayPort,
  ) {}

  async execute(command: { userId: string }): Promise<GroupListDto> {
    const instance = await this.instances.findByUserId(command.userId);
    if (!instance) {
      throw new WhatsappInstanceNotFoundException();
    }
    // Listar grupos exige sessão ativa — sem isso a Evolution devolveria vazio ou erro, e um
    // cache zerado apagaria a lista boa que o usuário já tinha.
    if (!instance.status.isConnected) {
      throw new WhatsappNotConnectedException();
    }

    const fetched = await this.gateway.listGroups(instance.instanceName.value, instance.token);

    const existing = new Map(
      (await this.groups.findAllByUserId(command.userId)).map((g) => [g.jid.value, g]),
    );

    let ignored = 0;
    const current: WhatsappGroup[] = [];
    for (const group of fetched) {
      if (!GroupJid.isValid(group.jid)) {
        // Não é grupo (ou JID fora do padrão) — nunca vira destino de mensagem.
        ignored += 1;
        continue;
      }
      const found = existing.get(group.jid);
      if (found) {
        found.refreshFrom({ name: group.name, participantsCount: group.participantsCount });
        current.push(found);
      } else {
        current.push(
          WhatsappGroup.create({
            userId: command.userId,
            instanceId: instance.id,
            jid: GroupJid.create(group.jid),
            name: group.name,
            participantsCount: group.participantsCount,
          }),
        );
      }
    }

    await this.groups.replaceAllForUser(command.userId, current);

    this.logger.log('Grupos sincronizados', {
      userId: command.userId,
      total: current.length,
      removidos: existing.size - current.filter((g) => existing.has(g.jid.value)).length,
      ignorados: ignored,
    });

    return GroupListDto.from(current, false);
  }
}
