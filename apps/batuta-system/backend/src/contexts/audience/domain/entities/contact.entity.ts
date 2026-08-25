import { AggregateRoot } from '@gitspread/domain-primitives';
import { PhoneE164 } from '../../../../shared/domain/value-objects/phone-e164.vo';
import { ContactId } from '../value-objects/contact-id.vo';
import { deriveFirstName } from '../value-objects/first-name.vo';
import { ContactOptedOutEvent } from '../events/contact-opted-out.event';
import { ContactSenderChangedEvent } from '../events/contact-sender-changed.event';
import { ContactAlreadyOptedOutException } from '../exceptions/contact-already-opted-out.exception';
import { ContactNotReactivatableException } from '../exceptions/contact-not-reactivatable.exception';
import { ContactNotRoutableException } from '../exceptions/contact-not-routable.exception';

/**
 * A person who receives messages.
 *
 * The invariant that defines this system lives here: **one contact, one sender, forever** (§1.2).
 * `current_channel_id` is set once at allocation and can only change through `migrateSender()`,
 * which demands a migration id — so there is no code path where a contact drifts to another chip.
 */
export class Contact extends AggregateRoot {
  private constructor(
    private readonly _id: ContactId,
    private readonly _accountId: string,
    private readonly _phone: PhoneE164,
    private _name: string | null,
    private _firstName: string | null,
    private _tags: string[],
    private _currentChannelId: string,
    private _active: boolean,
    private _optedOutAt: Date | null,
    private readonly _contactImportId: string | null,
    private readonly _createdAt: Date,
  ) {
    super();
  }

  static create(params: {
    accountId: string;
    phone: PhoneE164;
    name: string | null;
    tags?: string[];
    /** Decided by the allocator (§6.2) — never chosen by the caller. */
    channelId: string;
    contactImportId?: string | null;
  }): Contact {
    return new Contact(
      ContactId.generate(),
      params.accountId,
      params.phone,
      params.name?.trim() || null,
      // Derived once, at import, and persisted (§6.1 item 5).
      deriveFirstName(params.name),
      Contact.normalizeTags(params.tags ?? []),
      params.channelId,
      true,
      null,
      params.contactImportId ?? null,
      new Date(),
    );
  }

  static reconstitute(params: {
    id: ContactId;
    accountId: string;
    phone: PhoneE164;
    name: string | null;
    firstName: string | null;
    tags: string[];
    currentChannelId: string;
    active: boolean;
    optedOutAt: Date | null;
    contactImportId: string | null;
    createdAt: Date;
  }): Contact {
    return new Contact(
      params.id,
      params.accountId,
      params.phone,
      params.name,
      params.firstName,
      params.tags,
      params.currentChannelId,
      params.active,
      params.optedOutAt,
      params.contactImportId,
      params.createdAt,
    );
  }

  get id(): ContactId {
    return this._id;
  }

  get accountId(): string {
    return this._accountId;
  }

  get phone(): PhoneE164 {
    return this._phone;
  }

  get name(): string | null {
    return this._name;
  }

  /** Null means the merge field will use its fallback (§7.4) — counted before any dispatch. */
  get firstName(): string | null {
    return this._firstName;
  }

  get tags(): readonly string[] {
    return this._tags;
  }

  /**
   * THE sender. §6.3: "Não há escolha em tempo de despacho." A dispatch reads this and nothing else;
   * if the channel cannot send, the dispatch is BLOCKED — it never falls back to another channel.
   */
  get currentChannelId(): string {
    return this._currentChannelId;
  }

  get active(): boolean {
    return this._active;
  }

  get optedOutAt(): Date | null {
    return this._optedOutAt;
  }

  get hasOptedOut(): boolean {
    return this._optedOutAt !== null;
  }

  get contactImportId(): string | null {
    return this._contactImportId;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  /** Eligible to be included in a distribution (§9.1: excludes inactive and opted-out). */
  get isRoutable(): boolean {
    return this._active && !this.hasOptedOut;
  }

  /**
   * Permanent removal from routing (§6.5). Irreversible by design: there is no `optIn()` on this
   * entity and no endpoint that clears `opted_out_at` — someone who asked to be left alone stays
   * left alone, and re-adding them has to be a new, deliberate import.
   */
  optOut(reason: 'MANUAL' | 'KEYWORD', requestedBy: string | null): void {
    if (this.hasOptedOut) {
      throw new ContactAlreadyOptedOutException();
    }
    this._optedOutAt = new Date();
    this._active = false;
    this.addDomainEvent(
      new ContactOptedOutEvent(
        this._accountId,
        this._id.value,
        this._currentChannelId,
        reason,
        requestedBy,
      ),
    );
  }

  /**
   * The ONLY way a contact changes sender (§6.4). The migration id is mandatory precisely so this
   * cannot be called from a convenient place that happens to want a different channel — every change
   * is traceable to an approved, audited migration.
   */
  migrateSender(toChannelId: string, migrationId: string): void {
    if (!this.isRoutable) {
      // Migrating an opted-out contact would quietly put them back in someone's routing table.
      throw new ContactNotRoutableException();
    }
    if (toChannelId === this._currentChannelId) {
      return;
    }
    const from = this._currentChannelId;
    this._currentChannelId = toChannelId;
    this.addDomainEvent(
      new ContactSenderChangedEvent(
        this._accountId,
        this._id.value,
        from,
        toChannelId,
        migrationId,
      ),
    );
  }

  /**
   * Re-import of an existing phone: enriches what is empty and NEVER touches the sender
   * (§6.1 item 4: "Contato existente mantém o canal que já tinha. Duplicata nunca realoca.").
   *
   * @returns true when something actually changed, so the import can report it.
   */
  enrichFromReimport(params: { name: string | null; tags: string[] }): boolean {
    let changed = false;

    // A blank cell in a re-import must not erase a name someone already has.
    if (params.name && params.name.trim() && params.name.trim() !== this._name) {
      this._name = params.name.trim();
      this._firstName = deriveFirstName(params.name);
      changed = true;
    }

    const merged = Contact.normalizeTags([...this._tags, ...params.tags]);
    if (merged.length !== this._tags.length) {
      this._tags = merged;
      changed = true;
    }

    return changed;
  }

  deactivate(): void {
    this._active = false;
  }

  /**
   * Puts the contact back into routing.
   *
   * The counterpart of `deactivate()`, and it exists because a reversible flag with no way back is a
   * trap: most deactivations are a wrong number or a "stop sending to this one for now", and both get
   * revisited. Note the asymmetry with opt-out, which has NO counterpart on purpose — hence the guard
   * here rather than a bare assignment. `active = true` on someone who asked to leave would put them
   * back in the rotation, so the caller is refused instead.
   *
   * @throws when the contact has opted out — that suppression is permanent (§6.5).
   */
  reactivate(): void {
    if (this.hasOptedOut) {
      throw new ContactNotReactivatableException(
        'Este contato pediu para sair, e a saída é definitiva. Reativá-lo o colocaria de volta nos ' +
          'envios. Se o número deve voltar a receber, isso exige uma nova importação, com a ' +
          'procedência registrada.',
      );
    }
    this._active = true;
  }

  /**
   * Takes the contact out of routing pending human review (§10, FASE 7 item 6; §10.2, WRONG_NUMBER).
   *
   * It is `active = false` and nothing more, because `contacts` (§4) has no review column and adding
   * one is not this phase's call. The REASON lives in the audit trail, which is where "why is this
   * person out of the rotation?" is answered anyway.
   *
   * Deactivating rather than deleting matters: a wrong number is often a typo worth fixing, and the
   * row carries the import provenance the trail needs (§6.1).
   */
  flagForReview(): void {
    this._active = false;
  }

  /** Trimmed, de-duplicated, order-stable. Tags drive segmentation, so junk here becomes junk there. */
  private static normalizeTags(tags: readonly string[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const raw of tags) {
      const tag = (raw ?? '').trim();
      if (!tag) {
        continue;
      }
      const key = tag.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        result.push(tag);
      }
    }
    return result;
  }
}
