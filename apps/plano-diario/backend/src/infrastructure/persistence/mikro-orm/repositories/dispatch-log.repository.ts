import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import {
  EntityManager,
  EntityRepository,
  UniqueConstraintViolationException,
} from '@mikro-orm/core';
import { PaginatedResult } from '@gitspread/shared-kernel';
import { DispatchLogRepositoryPort } from '../../../../contexts/dispatch/application/ports/output/dispatch-log-repository.port';
import { DispatchLog } from '../../../../contexts/dispatch/domain/entities/dispatch-log.entity';
import { DispatchLogOrmEntity } from '../entities/dispatch-log-orm.entity';
import { DispatchLogMapper } from '../mappers/dispatch-log.mapper';

@Injectable()
export class MikroOrmDispatchLogRepository implements DispatchLogRepositoryPort {
  private readonly logger = new Logger(MikroOrmDispatchLogRepository.name);

  constructor(
    @InjectRepository(DispatchLogOrmEntity)
    private readonly repository: EntityRepository<DispatchLogOrmEntity>,
    private readonly em: EntityManager,
    private readonly mapper: DispatchLogMapper,
  ) {}

  /**
   * A idempotência acontece AQUI: tenta inserir e deixa o banco decidir. Violação da unique
   * parcial devolve `null` — nenhuma consulta prévia, que dois workers concorrentes furariam.
   */
  async createPending(log: DispatchLog): Promise<DispatchLog | null> {
    try {
      const orm = this.mapper.toOrm(log);
      await this.em.persistAndFlush(orm);
      return this.mapper.toDomain(orm);
    } catch (error) {
      if (error instanceof UniqueConstraintViolationException) {
        // Já existe envio agendado para (schedule_id, reference_date).
        this.em.clear();
        return null;
      }
      this.logger.error('Falha ao criar o log de envio', { message: (error as Error)?.message });
      throw error;
    }
  }

  async save(log: DispatchLog): Promise<DispatchLog> {
    const existing = await this.repository.findOne({ id: log.id });
    const orm = this.mapper.toOrm(log, existing ?? undefined);
    await this.em.persistAndFlush(orm);
    return this.mapper.toDomain(orm);
  }

  async findById(id: string): Promise<DispatchLog | null> {
    const orm = await this.repository.findOne({ id });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async findScheduledFor(scheduleId: string, referenceDate: string): Promise<DispatchLog | null> {
    const orm = await this.repository.findOne({
      scheduleId,
      referenceDate,
      trigger: 'scheduled',
    });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async countManualSince(userId: string, since: Date): Promise<number> {
    return this.repository.count({ userId, trigger: 'manual', createdAt: { $gte: since } });
  }

  async listByUser(
    userId: string,
    params: { page: number; limit: number },
  ): Promise<PaginatedResult<DispatchLog>> {
    const [rows, total] = await this.repository.findAndCount(
      { userId },
      {
        orderBy: { createdAt: 'DESC' },
        limit: params.limit,
        offset: (params.page - 1) * params.limit,
      },
    );

    const totalPages = Math.max(1, Math.ceil(total / params.limit));
    return {
      data: rows.map((orm) => this.mapper.toDomain(orm)),
      meta: {
        total,
        page: params.page,
        limit: params.limit,
        totalPages,
        hasNext: params.page < totalPages,
        hasPrevious: params.page > 1,
      },
    };
  }
}
