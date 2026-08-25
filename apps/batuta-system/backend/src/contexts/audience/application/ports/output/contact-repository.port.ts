import { PaginatedResult, PaginationParams } from '@gitspread/shared-kernel';
import { PhoneE164 } from '../../../../../shared/domain/value-objects/phone-e164.vo';
import { Contact } from '../../../domain/entities/contact.entity';
import { ContactId } from '../../../domain/value-objects/contact-id.vo';

export const CONTACT_REPOSITORY = Symbol('CONTACT_REPOSITORY');

export interface ListContactsFilter extends PaginationParams {
  /** Any of these tags. */
  tags?: string[];
  channelId?: string;
  active?: boolean;
  optedOut?: boolean;
  /** Matches name; never the phone, which is not searchable by fragment on purpose. */
  search?: string;
}

/**
 * A tag as it exists in the base, with how many routable contacts wear it.
 *
 * The count is not decoration: it is the audience size the operator is choosing, shown before the
 * preview instead of after — picking a tag that turns out to hold two people is a wasted round trip.
 */
export interface ContactTagCount {
  tag: string;
  contacts: number;
}

/** How many contacts each channel currently carries — the input to the greedy allocator (§6.2). */
export interface ChannelContactCount {
  channelId: string;
  contacts: number;
}

export interface ContactRepositoryPort {
  findById(id: ContactId): Promise<Contact | null>;
  /** The deduplication lookup of §6.1 item 4, scoped to the tenant by the global filter. */
  findByPhone(phone: PhoneE164): Promise<Contact | null>;
  findManyByPhones(phones: readonly string[]): Promise<Contact[]>;
  list(filter: ListContactsFilter): Promise<PaginatedResult<Contact>>;
  save(contact: Contact): Promise<Contact>;
  /**
   * Removes the contact for good.
   *
   * Conversations, messages and sender history cascade at the database level; `dispatches` does NOT
   * cascade — its foreign key refuses the delete — which is why the use case checks for sends first
   * and gives the operator a reason instead of letting Postgres answer with a 500.
   */
  delete(id: ContactId): Promise<void>;
  /** Batch insert for imports: one statement per chunk instead of one per contact. */
  saveMany(contacts: readonly Contact[]): Promise<void>;
  /**
   * Every distinct tag of the account, with its routable contact count.
   *
   * Exists so choosing an audience is picking from what is there instead of typing from memory: a
   * typed tag that does not exist produces an empty campaign and no error, which is the one failure
   * this list removes entirely.
   */
  listTags(): Promise<ContactTagCount[]>;

  /** Load per channel, for the allocator and for the migration preview. */
  countByChannel(): Promise<ChannelContactCount[]>;
  /** Routable contacts of one channel — what a migration moves. */
  listByChannel(channelId: string): Promise<Contact[]>;
  countByChannelId(channelId: string): Promise<number>;
}
