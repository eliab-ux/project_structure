import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityManager, EntityRepository } from '@mikro-orm/core';
import { WhatsappInstanceRepositoryPort } from '../../../../contexts/whatsapp/application/ports/output/whatsapp-instance-repository.port';
import { WhatsappInstance } from '../../../../contexts/whatsapp/domain/entities/whatsapp-instance.entity';
import { WhatsappInstanceOrmEntity } from '../entities/whatsapp-instance-orm.entity';
import { WhatsappInstanceMapper } from '../mappers/whatsapp-instance.mapper';

@Injectable()
export class MikroOrmWhatsappInstanceRepository implements WhatsappInstanceRepositoryPort {
  constructor(
    @InjectRepository(WhatsappInstanceOrmEntity)
    private readonly repository: EntityRepository<WhatsappInstanceOrmEntity>,
    private readonly em: EntityManager,
    private readonly mapper: WhatsappInstanceMapper,
  ) {}

  async findByPsicologo(psicologoId: string): Promise<WhatsappInstance | null> {
    const orm = await this.repository.findOne({ psicologoId });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async save(instance: WhatsappInstance): Promise<WhatsappInstance> {
    const existing = await this.repository.findOne({ psicologoId: instance.psicologoId });
    const orm = this.mapper.toOrm(instance, existing ?? undefined);
    await this.em.persistAndFlush(orm);
    return this.mapper.toDomain(orm);
  }

  async delete(psicologoId: string): Promise<void> {
    const orm = await this.repository.findOne({ psicologoId });
    if (orm) {
      await this.em.removeAndFlush(orm);
    }
  }
}
