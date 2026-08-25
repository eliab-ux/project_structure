import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { GroupListDto } from '../../dto/whatsapp-group.dto';
import {
  WHATSAPP_GROUP_REPOSITORY,
  WhatsappGroupRepositoryPort,
} from '../../ports/output/whatsapp-group-repository.port';
import { SyncGroupsUseCase } from '../sync-groups/sync-groups.use-case';

export interface ListGroupsCommand {
  userId: string;
  /** `true` quando o usuário aperta "Atualizar grupos" — força ida ao WhatsApp. */
  refresh?: boolean;
}

/**
 * Lista os grupos do cache. Só vai ao provider quando o usuário pede refresh — abrir a tela
 * não deve depender de uma chamada externa, e o cache existe exatamente para isso.
 *
 * Cache vazio conta como pedido de sincronização: na primeira vez não há o que exibir.
 */
@Injectable()
export class ListGroupsUseCase implements UseCase<ListGroupsCommand, GroupListDto> {
  constructor(
    @Inject(WHATSAPP_GROUP_REPOSITORY)
    private readonly groups: WhatsappGroupRepositoryPort,
    private readonly syncGroupsUseCase: SyncGroupsUseCase,
  ) {}

  async execute(command: ListGroupsCommand): Promise<GroupListDto> {
    const cached = await this.groups.findAllByUserId(command.userId);

    if (command.refresh || cached.length === 0) {
      return this.syncGroupsUseCase.execute({ userId: command.userId });
    }

    const stale = cached.some((group) => group.isStale());
    return GroupListDto.from(cached, stale);
  }
}
