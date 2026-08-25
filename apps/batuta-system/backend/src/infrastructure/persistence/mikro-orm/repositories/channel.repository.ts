import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import {
  ChannelRepositoryPort,
  ChannelReviewTarget,
  SendSlotReservation,
} from '../../../../contexts/channel/application/ports/output/channel-repository.port';
import { Channel } from '../../../../contexts/channel/domain/entities/channel.entity';
import { ChannelId } from '../../../../contexts/channel/domain/value-objects/channel-id.vo';
import {
  ChannelStatus,
  TERMINAL_STATUSES,
} from '../../../../contexts/channel/domain/value-objects/channel-status.vo';
import { PhoneE164 } from '../../../../shared/domain/value-objects/phone-e164.vo';
import { ChannelOrmEntity } from '../entities/channel-orm.entity';
import { TENANT_FILTER } from '../entities/tenant-scoped-orm.entity';
import { ChannelMapper } from '../mappers/channel.mapper';
import { ScopedRawQueryService } from '../scoped-raw-query.service';

/**
 * Every read is tenant-scoped by the inherited global filter — note the absence of any accountId
 * parameter. The single exception is `listAllForDailyReview`, which the cron needs and which is
 * documented at its definition.
 */
@Injectable()
export class MikroOrmChannelRepository implements ChannelRepositoryPort {
  constructor(
    private readonly em: EntityManager,
    private readonly mapper: ChannelMapper,
    private readonly raw: ScopedRawQueryService,
  ) {}

  async findById(id: ChannelId): Promise<Channel | null> {
    const orm = await this.em.findOne(ChannelOrmEntity, { id: id.value });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  /**
   * One conditional UPDATE, which is the entire concurrency argument — see the port for why.
   *
   * `last_send_at` doubles as the reservation and as the record of the last send. Keeping one column
   * instead of adding a separate "about to send" marker means a send that then FAILS still holds the
   * slot for one interval. That is the safe direction to be wrong in, and the same asymmetry the quota
   * already uses: waiting one extra interval costs nothing, a burst costs the chip.
   */
  async reserveSendSlot(input: {
    channelId: string;
    minIntervalSeconds: number;
  }): Promise<SendSlotReservation> {
    const taken = await this.raw.scoped<{ id: string }>(
      `update "channels"
          set "last_send_at" = now()
        where "id" = :channelId
          and "account_id" = :accountId
          and (
            "last_send_at" is null
            or "last_send_at" <= now() - make_interval(secs => :minIntervalSeconds)
          )
        returning "id"`,
      { channelId: input.channelId, minIntervalSeconds: input.minIntervalSeconds },
    );

    if (taken.length > 0) {
      return { allowed: true, waitMs: 0 };
    }

    // Refused: say how much of the interval is left, so the job comes back when the slot is free
    // rather than retrying blind.
    const [remaining] = await this.raw.scoped<{ wait_ms: string }>(
      `select greatest(
                0,
                ceil(
                  extract(
                    epoch from (
                      "last_send_at" + make_interval(secs => :minIntervalSeconds) - now()
                    )
                  ) * 1000
                )
              )::bigint as wait_ms
         from "channels"
        where "id" = :channelId and "account_id" = :accountId`,
      { channelId: input.channelId, minIntervalSeconds: input.minIntervalSeconds },
    );

    return { allowed: false, waitMs: Number(remaining?.wait_ms ?? 0) };
  }

  async findByPhone(phone: PhoneE164): Promise<Channel | null> {
    const orm = await this.em.findOne(ChannelOrmEntity, { phoneE164: phone.value });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async listByAccount(status?: ChannelStatus): Promise<Channel[]> {
    const rows = await this.em.find(ChannelOrmEntity, status ? { status } : {}, {
      orderBy: { createdAt: 'ASC' },
    });
    return rows.map((orm) => this.mapper.toDomain(orm));
  }

  async listConnected(): Promise<Channel[]> {
    const rows = await this.em.find(
      ChannelOrmEntity,
      { status: ChannelStatus.CONNECTED },
      { orderBy: { createdAt: 'ASC' } },
    );
    return rows.map((orm) => this.mapper.toDomain(orm));
  }

  async save(channel: Channel): Promise<Channel> {
    const orm = await this.em.upsert(ChannelOrmEntity, this.mapper.toOrmData(channel));
    await this.em.flush();
    return this.mapper.toDomain(orm);
  }

  async listAllForDailyReview(): Promise<ChannelReviewTarget[]> {
    // JOB SCOPE, not request scope: the daily cron has no JWT, so there is no tenant filter to
    // satisfy. It returns identities only — each job then establishes its own tenant scope from
    // accountId and re-reads the channel through the scoped findById.
    const rows = await this.em.find(
      ChannelOrmEntity,
      { status: { $nin: [...TERMINAL_STATUSES] } },
      {
        fields: ['id', 'accountId'],
        filters: { [TENANT_FILTER]: false },
        orderBy: { accountId: 'ASC', createdAt: 'ASC' },
      },
    );

    return rows.map((row) => ({ channelId: row.id, accountId: row.accountId }));
  }
}
