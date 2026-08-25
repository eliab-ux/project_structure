import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { PaginatedResult, Pagination } from '@gitspread/shared-kernel';
import {
  ChannelContactCount,
  ContactRepositoryPort,
  ContactTagCount,
  ListContactsFilter,
} from '../../../../contexts/audience/application/ports/output/contact-repository.port';
import { Contact } from '../../../../contexts/audience/domain/entities/contact.entity';
import { ContactId } from '../../../../contexts/audience/domain/value-objects/contact-id.vo';
import { PhoneE164 } from '../../../../shared/domain/value-objects/phone-e164.vo';
import { ContactOrmEntity } from '../entities/contact-orm.entity';
import { ContactMapper } from '../mappers/contact.mapper';
import { ScopedRawQueryService } from '../scoped-raw-query.service';

/** Rows per INSERT batch. Bounded so a 100k import does not build one gigantic statement. */
const INSERT_CHUNK = 500;

/**
 * Every read is tenant-scoped by the inherited global filter — there is no accountId parameter
 * anywhere in this class, and no method disables the filter.
 */
@Injectable()
export class MikroOrmContactRepository implements ContactRepositoryPort {
  constructor(
    private readonly em: EntityManager,
    private readonly mapper: ContactMapper,
    private readonly raw: ScopedRawQueryService,
  ) {}

  async findById(id: ContactId): Promise<Contact | null> {
    const orm = await this.em.findOne(ContactOrmEntity, { id: id.value });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async findByPhone(phone: PhoneE164): Promise<Contact | null> {
    const orm = await this.em.findOne(ContactOrmEntity, { phoneE164: phone.value });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async findManyByPhones(phones: readonly string[]): Promise<Contact[]> {
    if (phones.length === 0) {
      return [];
    }
    const rows = await this.em.find(ContactOrmEntity, { phoneE164: { $in: [...phones] } });
    return rows.map((orm) => this.mapper.toDomain(orm));
  }

  async list(filter: ListContactsFilter): Promise<PaginatedResult<Contact>> {
    const params = Pagination.create(filter.page, filter.limit);
    const where: Record<string, unknown> = {};

    if (filter.channelId) {
      where.currentChannelId = filter.channelId;
    }
    if (filter.active !== undefined) {
      where.active = filter.active;
    }
    if (filter.optedOut !== undefined) {
      where.optedOutAt = filter.optedOut ? { $ne: null } : null;
    }
    if (filter.tags?.length) {
      const stored = await this.storedTagsMatching(filter.tags);
      if (stored.length === 0) {
        // No stored tag matches, so nothing does. Returning early matters: an empty `$or` is an empty
        // condition, and MikroORM would drop it and hand back the WHOLE base — a filter that silently
        // becomes "everyone" is the worst possible failure for something that decides who gets a message.
        return Pagination.createResult([], 0, params);
      }
      // jsonb containment, served by the GIN index. Any of the given tags matches.
      where.$or = stored.map((tag) => ({ tags: { $contains: [tag] } }));
    }
    if (filter.search?.trim()) {
      // Name only. A phone is never searchable by fragment: that turns the list screen into a
      // lookup tool for numbers.
      where.name = { $ilike: `%${filter.search.trim()}%` };
    }

    const [rows, total] = await this.em.findAndCount(ContactOrmEntity, where, {
      limit: params.limit,
      offset: (params.page - 1) * params.limit,
      orderBy: { createdAt: 'DESC' },
    });

    return Pagination.createResult(
      rows.map((orm) => this.mapper.toDomain(orm)),
      total,
      params,
    );
  }

  /**
   * Resolves the tags someone typed to the tags actually stored, ignoring case.
   *
   * The mismatch this exists to close: a contact keeps its tag as it was written (`Brasilia`), while
   * every filter lowercases what the operator types (`brasilia`) — `TargetFilter` and the variant
   * assigner both do. jsonb containment is exact, so the two never met, and a campaign filtered by a
   * capitalised tag reported "nenhum contato enviável" while the contacts sat there wearing it.
   *
   * Resolving instead of comparing with `lower()` in the main query is deliberate: it keeps the GIN
   * index on `tags` doing the actual filtering. This lookup scans a set the size of the distinct tags
   * of one account, which is tiny, and the expensive query stays indexed.
   */
  private async storedTagsMatching(tags: readonly string[]): Promise<string[]> {
    const wanted = tags.map((tag) => tag.trim().toLowerCase()).filter((tag) => tag.length > 0);
    if (wanted.length === 0) {
      return [];
    }

    const rows = await this.raw.scoped<{ tag: string }>(
      `select distinct t.value as tag
         from contacts c, jsonb_array_elements_text(c.tags) as t(value)
        where c.account_id = :accountId
          and lower(t.value) = any(:wanted)`,
      { wanted },
    );
    return rows.map((row) => row.tag);
  }

  async save(contact: Contact): Promise<Contact> {
    const orm = await this.em.upsert(ContactOrmEntity, this.mapper.toOrmData(contact));
    await this.em.flush();
    return this.mapper.toDomain(orm);
  }

  async delete(id: ContactId): Promise<void> {
    // `nativeDelete` and not a loaded reference: the global tenant filter applies to it too, so a
    // contact of another account matches nothing and the call is a silent no-op rather than a leak.
    await this.em.nativeDelete(ContactOrmEntity, { id: id.value });
  }

  async saveMany(contacts: readonly Contact[]): Promise<void> {
    for (let offset = 0; offset < contacts.length; offset += INSERT_CHUNK) {
      const chunk = contacts.slice(offset, offset + INSERT_CHUNK);
      await this.em.insertMany(
        ContactOrmEntity,
        // The mapper returns a plain record on purpose (it must not depend on ORM types); the cast
        // is the one place that crossing costs us.
        chunk.map((contact) => this.mapper.toOrmData(contact)) as unknown as ContactOrmEntity[],
      );
    }
  }

  async countByChannel(): Promise<ChannelContactCount[]> {
    // Raw SQL through the scoped service, NOT the query builder. MikroORM prefixes every selected
    // expression with the alias, so `select(['count(*) as contacts'])` becomes `c.count(*)` and
    // Postgres rejects it — a 500 on the "carga por canal" panel. The same trap already cost three
    // aggregates in the distribution repository.
    //
    // `:accountId` is mandatory and injected by the service; only routable contacts count as load,
    // because an opted-out contact will never receive anything and counting it would make the
    // allocator avoid a channel that is in fact free.
    const rows = await this.raw.scoped<{ channel_id: string; contacts: string }>(
      `select "current_channel_id" as channel_id, count(*) as contacts
         from "contacts"
        where "account_id" = :accountId
          and "active" = true
          and "opted_out_at" is null
        group by "current_channel_id"`,
    );

    return rows.map((row) => ({
      channelId: row.channel_id,
      contacts: Number(row.contacts),
    }));
  }

  async listTags(): Promise<ContactTagCount[]> {
    // Only routable contacts are counted, for the same reason the channel load is: a tag whose
    // contacts all opted out is a tag that reaches nobody, and showing it with their number would
    // promise an audience that does not exist.
    //
    // Grouped by the LOWERCASED tag so `Brasilia` and `brasilia` are one entry rather than two that
    // look identical on screen; `min(...)` picks a stable spelling to display.
    const rows = await this.raw.scoped<{ tag: string; contacts: string }>(
      `select min(t.value) as tag, count(distinct c.id) as contacts
         from "contacts" c, jsonb_array_elements_text(c."tags") as t(value)
        where c."account_id" = :accountId
          and c."active" = true
          and c."opted_out_at" is null
        group by lower(t.value)
        order by 1`,
    );

    return rows.map((row) => ({ tag: row.tag, contacts: Number(row.contacts) }));
  }

  async listByChannel(channelId: string): Promise<Contact[]> {
    const rows = await this.em.find(
      ContactOrmEntity,
      { currentChannelId: channelId },
      { orderBy: { createdAt: 'ASC' } },
    );
    return rows.map((orm) => this.mapper.toDomain(orm));
  }

  async countByChannelId(channelId: string): Promise<number> {
    return this.em.count(ContactOrmEntity, {
      currentChannelId: channelId,
      active: true,
      optedOutAt: null,
    });
  }
}
