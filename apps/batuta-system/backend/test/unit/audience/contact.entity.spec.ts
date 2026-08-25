import { Contact } from '../../../src/contexts/audience/domain/entities/contact.entity';
import { deriveFirstName } from '../../../src/contexts/audience/domain/value-objects/first-name.vo';
import { ContactAlreadyOptedOutException } from '../../../src/contexts/audience/domain/exceptions/contact-already-opted-out.exception';
import { ContactNotReactivatableException } from '../../../src/contexts/audience/domain/exceptions/contact-not-reactivatable.exception';
import { ContactNotRoutableException } from '../../../src/contexts/audience/domain/exceptions/contact-not-routable.exception';
import { PhoneE164 } from '../../../src/shared/domain/value-objects/phone-e164.vo';

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const CHANNEL_A = 'aaaaaaaa-1111-4111-8111-111111111111';
const CHANNEL_B = 'bbbbbbbb-1111-4111-8111-111111111111';
const MIGRATION_ID = 'cccccccc-1111-4111-8111-111111111111';

function makeContact(name: string | null = 'Maria Silva', tags: string[] = []): Contact {
  return Contact.create({
    accountId: ACCOUNT_ID,
    phone: PhoneE164.create('11999998888'),
    name,
    tags,
    channelId: CHANNEL_A,
  });
}

describe('deriveFirstName (§6.1 item 5)', () => {
  it('takes the first word and capitalises it', () => {
    expect(deriveFirstName('Maria Silva')).toBe('Maria');
    expect(deriveFirstName('MARIA DA SILVA')).toBe('Maria');
    expect(deriveFirstName('maria')).toBe('Maria');
  });

  it('leaves an intentionally mixed-case name alone', () => {
    // The person wrote it that way; only all-caps/all-lower is a spreadsheet artefact.
    expect(deriveFirstName('MacIntyre Souza')).toBe('MacIntyre');
  });

  it('skips a leading particle', () => {
    expect(deriveFirstName('de Souza')).toBe('Souza');
    expect(deriveFirstName('DA SILVA JUNIOR')).toBe('Silva');
  });

  it('handles compound names', () => {
    expect(deriveFirstName('ANA-PAULA COSTA')).toBe('Ana-Paula');
    // "D'Ávila" is the Portuguese convention — both segments get a capital.
    expect(deriveFirstName("d'ávila Santos")).toBe("D'Ávila");
  });

  it('strips the junk that real exports carry', () => {
    expect(deriveFirstName('  João   Pedro ')).toBe('João');
    expect(deriveFirstName('Maria 😀')).toBe('Maria');
    expect(deriveFirstName('123 Maria')).toBe('Maria');
  });

  it('returns null when there is nothing usable — which is what the fallback count measures', () => {
    expect(deriveFirstName(null)).toBeNull();
    expect(deriveFirstName('')).toBeNull();
    expect(deriveFirstName('   ')).toBeNull();
    expect(deriveFirstName('123456')).toBeNull();
    expect(deriveFirstName('😀')).toBeNull();
    // An initial is not a name: greeting someone as "J" is worse than the fallback.
    expect(deriveFirstName('J. Silva')).toBeNull();
  });
});

describe('Contact', () => {
  it('derives and persists the first name at creation', () => {
    const contact = makeContact('MARIA SILVA');

    expect(contact.name).toBe('MARIA SILVA');
    expect(contact.firstName).toBe('Maria');
  });

  it('is routable when active and not opted out', () => {
    expect(makeContact().isRoutable).toBe(true);
  });

  it('normalises tags: trimmed, de-duplicated, order stable', () => {
    const contact = makeContact('Maria', [' vip ', 'VIP', 'zona-sul', '', 'vip']);

    expect(contact.tags).toEqual(['vip', 'zona-sul']);
  });

  describe('opt-out (§6.5)', () => {
    it('removes the contact from routing permanently', () => {
      const contact = makeContact();

      contact.optOut('MANUAL', 'user-1');

      expect(contact.hasOptedOut).toBe(true);
      expect(contact.optedOutAt).toBeInstanceOf(Date);
      expect(contact.active).toBe(false);
      expect(contact.isRoutable).toBe(false);
    });

    it('emits the event that feeds the opt_out_rate signal of the throttle', () => {
      const contact = makeContact();

      contact.optOut('KEYWORD', null);

      const events = contact.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0].eventName).toBe('contact.opted_out');
    });

    it('refuses a second opt-out instead of sending a second confirmation', () => {
      const contact = makeContact();
      contact.optOut('KEYWORD', null);

      expect(() => contact.optOut('KEYWORD', null)).toThrow(ContactAlreadyOptedOutException);
    });

    it('IS IRREVERSIBLE: nothing on the entity brings an opted-out contact back', () => {
      // §6.5: "irreversível pela UI".
      //
      // This used to be proved by the ABSENCE of a `reactivate` method. That method exists now — it is
      // the counterpart of `deactivate()`, which records an operator's decision and has to be
      // reversible. So the proof moved from "the name does not exist" to the behaviour itself, which is
      // the stronger claim: the one method that could clear `active` REFUSES an opted-out contact.
      const contact = makeContact();
      contact.optOut('KEYWORD', null);

      expect(() => contact.reactivate()).toThrow(ContactNotReactivatableException);
      expect(contact.hasOptedOut).toBe(true);
      expect(contact.isRoutable).toBe(false);

      // And there is still no method that clears `opted_out_at` at all.
      const methods = Object.getOwnPropertyNames(Contact.prototype);
      expect(methods).not.toContain('optIn');
      expect(methods.filter((name) => /optIn|undoOptOut|clearOptOut/i.test(name))).toEqual([]);
    });
  });

  describe('sender (§1.2, §6.3)', () => {
    it('starts on the channel the allocator chose', () => {
      expect(makeContact().currentChannelId).toBe(CHANNEL_A);
    });

    it('changes ONLY through a migration, which demands a migration id', () => {
      const contact = makeContact();

      contact.migrateSender(CHANNEL_B, MIGRATION_ID);

      expect(contact.currentChannelId).toBe(CHANNEL_B);
      const events = contact.pullDomainEvents();
      expect(events[0].eventName).toBe('contact.sender_changed');
      // The mandatory id is what stops a convenient caller from re-homing a contact casually.
      expect(Contact.prototype.migrateSender).toHaveLength(2);
    });

    it('has no other method that writes the sender', () => {
      const writers = Object.getOwnPropertyNames(Contact.prototype).filter(
        (name) =>
          /channel|sender/i.test(name) &&
          typeof Object.getOwnPropertyDescriptor(Contact.prototype, name)?.value === 'function',
      );
      expect(writers).toEqual(['migrateSender']);
    });

    it('migrating to the same channel is a no-op', () => {
      const contact = makeContact();

      contact.migrateSender(CHANNEL_A, MIGRATION_ID);

      expect(contact.pullDomainEvents()).toHaveLength(0);
    });

    it('refuses to migrate an opted-out contact back into a routing table', () => {
      const contact = makeContact();
      contact.optOut('MANUAL', 'user-1');

      expect(() => contact.migrateSender(CHANNEL_B, MIGRATION_ID)).toThrow(
        ContactNotRoutableException,
      );
    });
  });

  describe('re-import (§6.1 item 4)', () => {
    it('NEVER reallocates: the existing contact keeps the channel it had', () => {
      const contact = makeContact('Maria');

      contact.enrichFromReimport({ name: 'Maria Silva', tags: ['nova-tag'] });

      expect(contact.currentChannelId).toBe(CHANNEL_A);
    });

    it('fills in a better name and derives the first name again', () => {
      const contact = makeContact(null);
      expect(contact.firstName).toBeNull();

      const changed = contact.enrichFromReimport({ name: 'JOANA PRADO', tags: [] });

      expect(changed).toBe(true);
      expect(contact.name).toBe('JOANA PRADO');
      expect(contact.firstName).toBe('Joana');
    });

    it('a blank cell does NOT erase a name someone already has', () => {
      const contact = makeContact('Maria Silva');

      const changed = contact.enrichFromReimport({ name: '   ', tags: [] });

      expect(changed).toBe(false);
      expect(contact.name).toBe('Maria Silva');
    });

    it('merges tags without duplicating', () => {
      const contact = makeContact('Maria', ['vip']);

      const changed = contact.enrichFromReimport({ name: null, tags: ['VIP', 'centro'] });

      expect(changed).toBe(true);
      expect(contact.tags).toEqual(['vip', 'centro']);
    });

    it('reports no change when the row adds nothing', () => {
      const contact = makeContact('Maria Silva', ['vip']);

      expect(contact.enrichFromReimport({ name: 'Maria Silva', tags: ['vip'] })).toBe(false);
    });
  });
});
