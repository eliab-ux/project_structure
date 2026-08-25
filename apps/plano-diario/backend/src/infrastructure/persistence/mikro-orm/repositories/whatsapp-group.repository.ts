import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityManager, EntityRepository } from '@mikro-orm/core';
import { WhatsappGroupRepositoryPort } from '../../../../contexts/whatsapp/application/ports/output/whatsapp-group-repository.port';
import { WhatsappGroup } from '../../../../contexts/whatsapp/domain/entities/whatsapp-group.entity';
import { WhatsappGroupOrmEntity } from '../entities/whatsapp-group-orm.entity';
import { WhatsappGroupMapper } from '../mappers/whatsapp-group.mapper';

@Injectable()
export class MikroOrmWhatsappGroupRepository implements WhatsappGroupRepositoryPort {
  constructor(
    @InjectRepository(WhatsappGroupOrmEntity)
    private readonly repository: EntityRepository<WhatsappGroupOrmEntity>,
    private readonly em: EntityManager,
    private readonly mapper: WhatsappGroupMapper,
  ) {}

  async findAllByUserId(userId: string): Promise<WhatsappGroup[]> {
    const rows = await this.repository.find({ userId }, { orderBy: { name: 'ASC' } });
    return rows.map((orm) => this.mapper.toDomain(orm));
  }

  async findByUserAndJid(userId: string, jid: string): Promise<WhatsappGroup | null> {
    const orm = await this.repository.findOne({ userId, groupJid: jid });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  /**
   * Substitui o cache do usuário numa transação: atualiza os presentes, insere os novos e
   * remove os ausentes. Transacional para a lista nunca ser lida pela metade — o cache é o que
   * valida o destino da mensagem, então um estado intermediário poderia recusar um grupo válido.
   */
  async replaceAllForUser(userId: string, groups: WhatsappGroup[]): Promise<void> {
    await this.em.transactional(async (em) => {
      const existing = await em.find(WhatsappGroupOrmEntity, { userId });
      const keep = new Set(groups.map((g) => g.jid.value));

      for (const orm of existing) {
        if (!keep.has(orm.groupJid)) {
          em.remove(orm);
        }
      }

      const byJid = new Map(existing.map((orm) => [orm.groupJid, orm]));
      for (const group of groups) {
        em.persist(this.mapper.toOrm(group, byJid.get(group.jid.value)));
      }
    });
  }
}
