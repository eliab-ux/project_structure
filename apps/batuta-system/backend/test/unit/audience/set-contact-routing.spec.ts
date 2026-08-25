import { DeactivateContactUseCase } from '../../../src/contexts/audience/application/use-cases/set-contact-routing/deactivate-contact.use-case';
import { ReactivateContactUseCase } from '../../../src/contexts/audience/application/use-cases/set-contact-routing/reactivate-contact.use-case';
import {
  DeactivateContactCommand,
  ReactivateContactCommand,
} from '../../../src/contexts/audience/application/use-cases/set-contact-routing/set-contact-routing.command';
import { ContactRepositoryPort } from '../../../src/contexts/audience/application/ports/output/contact-repository.port';
import { Contact } from '../../../src/contexts/audience/domain/entities/contact.entity';
import { ContactId } from '../../../src/contexts/audience/domain/value-objects/contact-id.vo';
import { ContactNotFoundException } from '../../../src/contexts/audience/domain/exceptions/contact-not-found.exception';
import { ContactNotReactivatableException } from '../../../src/contexts/audience/domain/exceptions/contact-not-reactivatable.exception';
import { RecordAuditLogUseCase } from '../../../src/contexts/audit/application/use-cases/record-audit-log.use-case';
import { AuditAction } from '../../../src/contexts/audit/domain/value-objects/audit-action.vo';
import { PhoneE164 } from '../../../src/shared/domain/value-objects/phone-e164.vo';

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const CONTACT_ID = 'dddddddd-1111-4111-8111-111111111111';
const CHANNEL_ID = 'cccccccc-1111-4111-8111-111111111111';
const USER_ID = 'aaaaaaaa-1111-4111-8111-111111111111';

function contact(overrides: { active?: boolean; optedOutAt?: Date | null } = {}): Contact {
  return Contact.reconstitute({
    id: ContactId.from(CONTACT_ID),
    accountId: ACCOUNT_ID,
    phone: PhoneE164.create('11988887777'),
    name: 'Priscila',
    firstName: 'Priscila',
    tags: ['Brasilia'],
    currentChannelId: CHANNEL_ID,
    active: overrides.active ?? true,
    optedOutAt: overrides.optedOutAt ?? null,
    contactImportId: null,
    createdAt: new Date('2026-07-01T00:00:00Z'),
  });
}

/**
 * The gap this closes: `DeleteContactUseCase` refuses a contact that already appears in a dispatch —
 * correctly, that record is the proof of what was sent — and for a long while its refusal pointed the
 * operator at a "Remover dos envios" action that had never been built. So "this one must stop receiving
 * but I cannot delete them" had no expression at all.
 */
describe('DeactivateContactUseCase', () => {
  let contacts: jest.Mocked<ContactRepositoryPort>;
  let audit: { execute: jest.Mock };
  let useCase: DeactivateContactUseCase;

  const command = new DeactivateContactCommand(ACCOUNT_ID, USER_ID, CONTACT_ID, '203.0.113.7');

  function mount(given: Contact): void {
    contacts = {
      findById: jest.fn(async () => given),
      save: jest.fn(async (saved: Contact) => saved),
    } as unknown as jest.Mocked<ContactRepositoryPort>;
    audit = { execute: jest.fn() };
    useCase = new DeactivateContactUseCase(contacts, audit as unknown as RecordAuditLogUseCase);
  }

  beforeEach(() => mount(contact()));

  it('takes the contact out of routing without deleting the row', async () => {
    const result = await useCase.execute(command);

    expect(result.active).toBe(false);
    expect(contacts.save).toHaveBeenCalledTimes(1);
  });

  it('makes the contact unroutable, which is what keeps it out of every distribution', async () => {
    // `isRoutable` is the single predicate the planner (§9.1) and the executor both read. Asserting on
    // it rather than on `active` is asserting on the thing that actually stops the send.
    const target = contact();
    mount(target);

    await useCase.execute(command);

    expect(target.isRoutable).toBe(false);
  });

  it('does NOT mark an opt-out — that metric cuts the chip quota', async () => {
    // Filing an operator's housekeeping as "the contact asked to leave" would push `opt_out_rate` up,
    // and 2% halves the channel's quota (throttle-policy). It must stay a different fact.
    const target = contact();
    mount(target);

    await useCase.execute(command);

    expect(target.hasOptedOut).toBe(false);
    expect(target.optedOutAt).toBeNull();
    expect(audit.execute.mock.calls[0][0].action).toBe(AuditAction.CONTACT_DEACTIVATED);
    expect(audit.execute.mock.calls[0][0].action).not.toBe(AuditAction.CONTACT_OPTED_OUT);
  });

  it('records the audit line with the phone MASKED', async () => {
    await useCase.execute(command);

    const entry = audit.execute.mock.calls[0][0];
    expect(entry.entityId).toBe(CONTACT_ID);
    expect(entry.actorId).toBe(USER_ID);
    // The trail says WHICH contact without printing the number (§16).
    expect(entry.payload.phoneMasked).not.toContain('88887777');
  });

  it('is idempotent and writes no audit noise for an already-inactive contact', async () => {
    mount(contact({ active: false }));

    const result = await useCase.execute(command);

    expect(result.active).toBe(false);
    expect(contacts.save).not.toHaveBeenCalled();
    expect(audit.execute).not.toHaveBeenCalled();
  });

  it('a contact of another account is simply not found', async () => {
    contacts.findById = jest.fn(async (_id: ContactId) => null);

    await expect(useCase.execute(command)).rejects.toBeInstanceOf(ContactNotFoundException);
  });
});

describe('ReactivateContactUseCase', () => {
  let contacts: jest.Mocked<ContactRepositoryPort>;
  let audit: { execute: jest.Mock };
  let useCase: ReactivateContactUseCase;

  const command = new ReactivateContactCommand(ACCOUNT_ID, USER_ID, CONTACT_ID, '203.0.113.7');

  function mount(given: Contact): void {
    contacts = {
      findById: jest.fn(async () => given),
      save: jest.fn(async (saved: Contact) => saved),
    } as unknown as jest.Mocked<ContactRepositoryPort>;
    audit = { execute: jest.fn() };
    useCase = new ReactivateContactUseCase(contacts, audit as unknown as RecordAuditLogUseCase);
  }

  it('puts a deactivated contact back into routing', async () => {
    const target = contact({ active: false });
    mount(target);

    const result = await useCase.execute(command);

    expect(result.active).toBe(true);
    expect(target.isRoutable).toBe(true);
    expect(audit.execute.mock.calls[0][0].action).toBe(AuditAction.CONTACT_REACTIVATED);
  });

  it('REFUSES to reactivate someone who asked to leave', async () => {
    // The asymmetry that matters: deactivation records an operator's decision and is reversible; an
    // opt-out records the contact's and is not (§6.5). Reactivating would put them back in the rotation.
    mount(contact({ active: false, optedOutAt: new Date('2026-07-15T00:00:00Z') }));

    await expect(useCase.execute(command)).rejects.toBeInstanceOf(ContactNotReactivatableException);
    expect(contacts.save).not.toHaveBeenCalled();
    expect(audit.execute).not.toHaveBeenCalled();
  });

  it('is idempotent for an already-active contact', async () => {
    mount(contact({ active: true }));

    const result = await useCase.execute(command);

    expect(result.active).toBe(true);
    expect(contacts.save).not.toHaveBeenCalled();
    expect(audit.execute).not.toHaveBeenCalled();
  });
});

describe('Contact.reactivate — the guard lives in the entity', () => {
  it('refuses an opted-out contact whatever path reaches it', () => {
    // In the entity and not in the use case, so no future caller can set active = true on someone who
    // asked to be left alone.
    const target = contact({ active: false, optedOutAt: new Date('2026-07-15T00:00:00Z') });

    expect(() => target.reactivate()).toThrow(ContactNotReactivatableException);
    expect(target.active).toBe(false);
  });

  it('reverses a plain deactivation', () => {
    const target = contact();

    target.deactivate();
    expect(target.isRoutable).toBe(false);

    target.reactivate();
    expect(target.isRoutable).toBe(true);
  });
});
