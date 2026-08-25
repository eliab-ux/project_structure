import { Inject, Injectable } from '@nestjs/common';
import {
  DirectoryGroup,
  GroupDirectoryPort,
} from '../../contexts/schedule/application/ports/output/group-directory.port';
import {
  WHATSAPP_GROUP_REPOSITORY,
  WhatsappGroupRepositoryPort,
} from '../../contexts/whatsapp/application/ports/output/whatsapp-group-repository.port';

/**
 * Ponte entre o context `schedule` e o cache de grupos do `whatsapp`. Fica na infraestrutura
 * justamente para que nenhum dos dois contexts precise conhecer o outro.
 */
@Injectable()
export class WhatsappGroupDirectoryAdapter implements GroupDirectoryPort {
  constructor(
    @Inject(WHATSAPP_GROUP_REPOSITORY)
    private readonly groups: WhatsappGroupRepositoryPort,
  ) {}

  async findByUserAndJid(userId: string, jid: string): Promise<DirectoryGroup | null> {
    const group = await this.groups.findByUserAndJid(userId, jid);
    return group ? { jid: group.jid.value, name: group.name } : null;
  }
}
