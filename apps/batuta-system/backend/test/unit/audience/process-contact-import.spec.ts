import { ChannelRepositoryPort } from '../../../src/contexts/channel/application/ports/output/channel-repository.port';
import { Channel } from '../../../src/contexts/channel/domain/entities/channel.entity';
import { ChannelId } from '../../../src/contexts/channel/domain/value-objects/channel-id.vo';
import { ChannelStatus } from '../../../src/contexts/channel/domain/value-objects/channel-status.vo';
import { QuotaBand } from '../../../src/contexts/channel/domain/value-objects/quota-band.vo';
import { ContactRepositoryPort } from '../../../src/contexts/audience/application/ports/output/contact-repository.port';
import {
  ContactFileParserPort,
  ContactImportRepositoryPort,
  ContactSenderHistoryRepositoryPort,
  ParsedContactRow,
} from '../../../src/contexts/audience/application/ports/output/contact-import.ports';
import { ProcessContactImportUseCase } from '../../../src/contexts/audience/application/use-cases/process-contact-import/process-contact-import.use-case';
import { ProcessContactImportCommand } from '../../../src/contexts/audience/application/use-cases/process-contact-import/process-contact-import.command';
import { Contact } from '../../../src/contexts/audience/domain/entities/contact.entity';
import { ContactImport } from '../../../src/contexts/audience/domain/entities/contact-import.entity';
import { ConsentBasis } from '../../../src/contexts/audience/domain/value-objects/consent-basis.vo';
import { AllocationReason } from '../../../src/contexts/audience/domain/value-objects/allocation-reason.vo';
import { ImportStatus } from '../../../src/contexts/audience/domain/value-objects/import-status.vo';
import { RecordAuditLogUseCase } from '../../../src/contexts/audit/application/use-cases/record-audit-log.use-case';
import { EventPublisherPort } from '../../../src/infrastructure/persistence/ports/event-publisher.port';
import { FileStoragePort } from '../../../src/infrastructure/storage/ports/file-storage.port';
import { PhoneE164 } from '../../../src/shared/domain/value-objects/phone-e164.vo';

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = 'dddddddd-1111-4111-8111-111111111111';

let channelPhoneSeq = 0;

function makeChannel(id: string, status: ChannelStatus, createdAt: string): Channel {
  channelPhoneSeq += 1;
  return Channel.reconstitute({
    id: ChannelId.from(id),
    accountId: ACCOUNT_ID,
    label: `Chip ${id.slice(0, 4)}`,
    // A real, distinct landline per channel — the VO rejects anything that is not E.164-able.
    phone: PhoneE164.create(`113333${String(1000 + channelPhoneSeq).slice(-4)}`),
    evolutionInstanceName: `acct-${ACCOUNT_ID}-ch-${id}`,
    status,
    warmupStartedAt: new Date(createdAt),
    quota: QuotaBand.create(20, 150),
    consecutiveFailures: 0,
    lastSendAt: null,
    lastQuotaReviewAt: null,
    disconnectEventsToday: 0,
    lastDisconnectAt: null,
    retiredAt: null,
    retiredBy: null,
    terminalReason: null,
    createdAt: new Date(createdAt),
  });
}

const CHANNEL_A = 'aaaaaaaa-1111-4111-8111-111111111111';
const CHANNEL_B = 'bbbbbbbb-1111-4111-8111-111111111111';
const CHANNEL_DEAD = 'cccccccc-1111-4111-8111-111111111111';

function row(
  lineNumber: number,
  phone: string | null,
  name: string | null = null,
): ParsedContactRow {
  return { lineNumber, phone, name, tags: [] };
}

describe('ProcessContactImportUseCase (§6.1)', () => {
  let imports: jest.Mocked<ContactImportRepositoryPort>;
  let contacts: jest.Mocked<ContactRepositoryPort>;
  let history: jest.Mocked<ContactSenderHistoryRepositoryPort>;
  let channels: jest.Mocked<ChannelRepositoryPort>;
  let parser: jest.Mocked<ContactFileParserPort>;
  let storage: jest.Mocked<FileStoragePort>;
  let events: jest.Mocked<EventPublisherPort>;
  let audit: jest.Mocked<Pick<RecordAuditLogUseCase, 'execute'>>;
  let useCase: ProcessContactImportUseCase;
  let contactImport: ContactImport;
  let saved: Contact[];

  beforeEach(() => {
    contactImport = ContactImport.start({
      accountId: ACCOUNT_ID,
      fileName: 'base.csv',
      storageKey: 'contact-imports/x.csv',
      uploadedBy: USER_ID,
      consentBasis: ConsentBasis.EXISTING_RELATIONSHIP,
      originNote: 'Base do gabinete, atendimentos de 2025',
    });
    saved = [];

    imports = {
      findById: jest.fn(async () => contactImport),
      listRecent: jest.fn(),
      save: jest.fn(async (i) => i),
      appendErrors: jest.fn(),
      listErrors: jest.fn(),
    } as unknown as jest.Mocked<ContactImportRepositoryPort>;

    contacts = {
      findById: jest.fn(),
      findByPhone: jest.fn(),
      findManyByPhones: jest.fn(async () => []),
      list: jest.fn(),
      save: jest.fn(async (c) => c),
      saveMany: jest.fn(async (batch) => {
        saved.push(...batch);
      }),
      countByChannel: jest.fn(async () => []),
      listByChannel: jest.fn(),
      countByChannelId: jest.fn(),
    } as unknown as jest.Mocked<ContactRepositoryPort>;

    history = {
      appendMany: jest.fn(),
      releaseOpenEntries: jest.fn(),
      listForContact: jest.fn(),
    } as unknown as jest.Mocked<ContactSenderHistoryRepositoryPort>;

    channels = {
      findById: jest.fn(),
      findByPhone: jest.fn(),
      listByAccount: jest.fn(async () => [
        makeChannel(CHANNEL_A, ChannelStatus.CONNECTED, '2026-01-01'),
        makeChannel(CHANNEL_B, ChannelStatus.CONNECTED, '2026-02-01'),
      ]),
      listConnected: jest.fn(),
      save: jest.fn(),
      listAllForDailyReview: jest.fn(),
    } as unknown as jest.Mocked<ChannelRepositoryPort>;

    parser = { parse: jest.fn() } as unknown as jest.Mocked<ContactFileParserPort>;
    storage = {
      putObject: jest.fn(),
      getObject: jest.fn(async () => Buffer.from('phone\n')),
      getSignedUrl: jest.fn(),
    } as unknown as jest.Mocked<FileStoragePort>;
    events = {
      publish: jest.fn(),
      publishAll: jest.fn(),
    } as unknown as jest.Mocked<EventPublisherPort>;
    audit = { execute: jest.fn() };

    useCase = new ProcessContactImportUseCase(
      imports,
      contacts,
      history,
      channels,
      parser,
      storage,
      events,
      audit as unknown as RecordAuditLogUseCase,
    );
  });

  function command(): ProcessContactImportCommand {
    return new ProcessContactImportCommand(
      ACCOUNT_ID,
      contactImport.id,
      { phone: 'telefone', name: 'nome', tags: null },
      true,
    );
  }

  function givenRows(rows: ParsedContactRow[]): void {
    parser.parse.mockResolvedValue({ rows, detectedColumns: ['telefone', 'nome'] });
  }

  it('imports valid rows, normalising every phone to E.164', async () => {
    givenRows([
      row(2, '11999998888', 'Maria Silva'),
      row(3, '(11) 98888-7777', 'JOÃO PEDRO'),
      row(4, '+5521977776666', 'ana'),
    ]);

    const result = await useCase.execute(command());

    expect(result.importedCount).toBe(3);
    expect(result.status).toBe(ImportStatus.COMPLETED);
    expect(saved.map((c) => c.phone.value)).toEqual([
      '+5511999998888',
      '+5511988887777',
      '+5521977776666',
    ]);
  });

  it('derives and persists first_name, counting the misses (§6.1 item 5 → §7.4)', async () => {
    givenRows([
      row(2, '11999998888', 'Maria Silva'),
      row(3, '11988887777', null),
      row(4, '21977776666', '123'),
    ]);

    const result = await useCase.execute(command());

    expect(saved[0].firstName).toBe('Maria');
    expect(saved[1].firstName).toBeNull();
    // The operator learns the fallback volume BEFORE dispatching.
    expect(result.missingFirstNameCount).toBe(2);
  });

  describe('invalid phones (§6.1 item 3)', () => {
    it('reports them by line and never imports a raw phone', async () => {
      givenRows([
        row(2, '123', 'Curto'),
        row(3, null, 'Sem telefone'),
        row(4, '11999998888', 'Ok'),
      ]);

      const result = await useCase.execute(command());

      expect(result.invalidCount).toBe(2);
      expect(result.importedCount).toBe(1);
      const [, , errors] = imports.appendErrors.mock.calls[0];
      expect(errors).toEqual([
        expect.objectContaining({ lineNumber: 2, reason: expect.stringMatching(/E\.164/) }),
        expect.objectContaining({ lineNumber: 3, reason: 'Telefone ausente' }),
      ]);
    });

    it('masks the offending value in the error report', async () => {
      givenRows([row(2, '11999', 'Curto')]);

      await useCase.execute(command());

      const [, , errors] = imports.appendErrors.mock.calls[0];
      // Enough to recognise the row, never a usable number sitting in an error table.
      expect(errors[0].rawValueMasked).toBe('11*99');
    });
  });

  describe('deduplication (§6.1 item 4)', () => {
    it('an existing contact KEEPS its channel — a duplicate never reallocates', async () => {
      const existing = Contact.create({
        accountId: ACCOUNT_ID,
        phone: PhoneE164.create('11999998888'),
        name: 'Maria',
        channelId: CHANNEL_DEAD,
      });
      contacts.findManyByPhones.mockResolvedValue([existing]);
      givenRows([row(2, '11999998888', 'Maria Silva Souza')]);

      const result = await useCase.execute(command());

      expect(result.duplicatedCount).toBe(1);
      expect(result.importedCount).toBe(0);
      // Still on the old channel, even though that channel is not in the eligible list.
      expect(existing.currentChannelId).toBe(CHANNEL_DEAD);
    });

    it('enriches the existing contact instead of ignoring the row', async () => {
      const existing = Contact.create({
        accountId: ACCOUNT_ID,
        phone: PhoneE164.create('11999998888'),
        name: null,
        channelId: CHANNEL_DEAD,
      });
      contacts.findManyByPhones.mockResolvedValue([existing]);
      givenRows([row(2, '11999998888', 'MARIA SILVA')]);

      await useCase.execute(command());

      expect(existing.name).toBe('MARIA SILVA');
      expect(existing.firstName).toBe('Maria');
      expect(contacts.save).toHaveBeenCalledWith(existing);
    });

    it('counts the same number twice IN THE SAME FILE as a duplicate', async () => {
      // Otherwise the unique key would abort the whole chunk.
      givenRows([
        row(2, '11999998888', 'Maria'),
        row(3, '+5511999998888', 'Maria de novo'),
        row(4, '(11) 99999-8888', 'Maria terceira vez'),
      ]);

      const result = await useCase.execute(command());

      expect(result.importedCount).toBe(1);
      expect(result.duplicatedCount).toBe(2);
    });
  });

  describe('allocation (§6.2)', () => {
    it('spreads new contacts across connected channels', async () => {
      givenRows([
        row(2, '11999998888'),
        row(3, '11988887777'),
        row(4, '11977776666'),
        row(5, '11966665555'),
      ]);

      await useCase.execute(command());

      expect(saved.map((c) => c.currentChannelId)).toEqual([
        CHANNEL_A,
        CHANNEL_B,
        CHANNEL_A,
        CHANNEL_B,
      ]);
    });

    it('gives everything to a new channel until it draws level', async () => {
      channels.listByAccount.mockResolvedValue([
        makeChannel(CHANNEL_A, ChannelStatus.CONNECTED, '2026-01-01'),
        makeChannel(CHANNEL_B, ChannelStatus.CONNECTED, '2026-06-01'),
      ]);
      contacts.countByChannel.mockResolvedValue([{ channelId: CHANNEL_A, contacts: 2 }]);
      givenRows([row(2, '11999998888'), row(3, '11988887777'), row(4, '11977776666')]);

      await useCase.execute(command());

      expect(saved.map((c) => c.currentChannelId)).toEqual([CHANNEL_B, CHANNEL_B, CHANNEL_A]);
    });

    it('NEVER allocates to a channel that is not CONNECTED', async () => {
      channels.listByAccount.mockResolvedValue([
        makeChannel(CHANNEL_A, ChannelStatus.DISCONNECTED, '2026-01-01'),
        makeChannel(CHANNEL_B, ChannelStatus.CONNECTED, '2026-02-01'),
      ]);
      givenRows([row(2, '11999998888'), row(3, '11988887777')]);

      await useCase.execute(command());

      expect(saved.every((c) => c.currentChannelId === CHANNEL_B)).toBe(true);
    });

    it('writes sender history with INITIAL_ALLOCATION for every new contact', async () => {
      givenRows([row(2, '11999998888')]);

      await useCase.execute(command());

      // §4: never set current_channel_id without writing history.
      expect(history.appendMany).toHaveBeenCalledWith(ACCOUNT_ID, [
        expect.objectContaining({
          channelId: CHANNEL_A,
          reason: AllocationReason.INITIAL_ALLOCATION,
        }),
      ]);
    });

    it('FAILS the import with a clear message when no channel is eligible', async () => {
      channels.listByAccount.mockResolvedValue([
        makeChannel(CHANNEL_A, ChannelStatus.DISCONNECTED, '2026-01-01'),
        makeChannel(CHANNEL_DEAD, ChannelStatus.BANNED, '2026-01-02'),
      ]);
      givenRows([row(2, '11999998888')]);

      const result = await useCase.execute(command());

      // §6.2: importing contacts with no sender would produce a base that can never be messaged.
      expect(result.status).toBe(ImportStatus.FAILED);
      expect(result.errorMessage).toMatch(/Conecte um chip/);
      expect(contacts.saveMany).not.toHaveBeenCalled();
    });
  });

  it('reports progress so the operator sees movement, then completes', async () => {
    givenRows([row(2, '11999998888'), row(3, '11988887777')]);

    const result = await useCase.execute(command());

    expect(result.totalRows).toBe(2);
    expect(result.processedRows).toBe(2);
    expect(result.progressPercent).toBe(100);
    // Saved more than once: at least PROCESSING, per-chunk progress and COMPLETED.
    expect(imports.save.mock.calls.length).toBeGreaterThan(2);
  });

  it('records the final counters in the audit trail as SYSTEM', async () => {
    givenRows([row(2, '11999998888')]);

    await useCase.execute(command());

    expect(audit.execute).toHaveBeenCalledWith(
      expect.objectContaining({ payload: expect.objectContaining({ imported: 1 }) }),
    );
  });

  it('records a parse failure on the import row instead of throwing at the worker', async () => {
    parser.parse.mockRejectedValue(new Error('Coluna de telefone "telefone" não encontrada'));

    const result = await useCase.execute(command());

    expect(result.status).toBe(ImportStatus.FAILED);
    expect(result.errorMessage).toMatch(/Coluna de telefone/);
  });
});

describe('ContactImport — provenance (§6.1 item 6)', () => {
  it('refuses an import with no origin note', () => {
    expect(() =>
      ContactImport.start({
        accountId: ACCOUNT_ID,
        fileName: 'base.csv',
        storageKey: 'k',
        uploadedBy: USER_ID,
        consentBasis: ConsentBasis.PUBLIC_SOURCE,
        originNote: '   ',
      }),
    ).toThrow(/base de consentimento e a origem/);
  });

  it('refuses a token origin note — it has to be an actual answer', () => {
    expect(() =>
      ContactImport.start({
        accountId: ACCOUNT_ID,
        fileName: 'base.csv',
        storageKey: 'k',
        uploadedBy: USER_ID,
        consentBasis: ConsentBasis.PUBLIC_SOURCE,
        originNote: 'lista',
      }),
    ).toThrow(/base de consentimento e a origem/);
  });

  it('accepts a real one', () => {
    const contactImport = ContactImport.start({
      accountId: ACCOUNT_ID,
      fileName: 'base.csv',
      storageKey: 'k',
      uploadedBy: USER_ID,
      consentBasis: ConsentBasis.EXPLICIT_OPT_IN,
      originNote: 'Formulário do site, campanha de março',
    });

    expect(contactImport.status).toBe(ImportStatus.PENDING);
    expect(contactImport.consentBasis).toBe(ConsentBasis.EXPLICIT_OPT_IN);
  });
});
