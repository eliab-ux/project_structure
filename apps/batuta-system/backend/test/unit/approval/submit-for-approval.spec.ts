import { ConfigService } from '@nestjs/config';
import { SubmitForApprovalUseCase } from '../../../src/contexts/approval/application/use-cases/submit-for-approval/submit-for-approval.use-case';
import { SubmitForApprovalCommand } from '../../../src/contexts/approval/application/use-cases/submit-for-approval/submit-for-approval.command';
import {
  ApprovalRequestRepositoryPort,
  ApprovalSettingsRepositoryPort,
  ApproverRepositoryPort,
  ContentAuthorProviderPort,
} from '../../../src/contexts/approval/application/ports/output/approval-repositories.port';
import { SystemNotifierPort } from '../../../src/contexts/approval/application/ports/output/system-notifier.port';
import { ApprovalRequest } from '../../../src/contexts/approval/domain/entities/approval-request.entity';
import { ApprovalSettings } from '../../../src/contexts/approval/domain/entities/approval-settings.entity';
import { Approver } from '../../../src/contexts/approval/domain/entities/approver.entity';
import { NotifyChannel } from '../../../src/contexts/approval/domain/value-objects/notify-channel.vo';
import {
  ApproverCannotBeAuthorException,
  NotEnoughApproversException,
} from '../../../src/contexts/approval/domain/exceptions/approver-cannot-be-author.exception';
import { NoActiveApproverException } from '../../../src/contexts/approval/domain/exceptions/no-active-approver.exception';
import { ContentRepositoryPort } from '../../../src/contexts/content/application/ports/output/content-repository.port';
import { Content } from '../../../src/contexts/content/domain/entities/content.entity';
import { ContentClassification } from '../../../src/contexts/content/domain/value-objects/content-classification.vo';
import { ContentOrigin } from '../../../src/contexts/content/domain/value-objects/content-origin.vo';
import { ContentStatus } from '../../../src/contexts/content/domain/value-objects/content-status.vo';
import { RecordAuditLogUseCase } from '../../../src/contexts/audit/application/use-cases/record-audit-log.use-case';
import { AuditAction } from '../../../src/contexts/audit/domain/value-objects/audit-action.vo';
import { UnitOfWorkPort } from '../../../src/infrastructure/persistence/ports/unit-of-work.port';
import { Email } from '../../../src/contexts/user/domain/value-objects/email.vo';
import { PhoneE164 } from '../../../src/shared/domain/value-objects/phone-e164.vo';

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const AUTHOR_ID = 'aaaaaaaa-1111-4111-8111-111111111111';
const AUTHOR_EMAIL = 'autor@exemplo.com';

function makeContent(classification = ContentClassification.INSTITUTIONAL): Content {
  return Content.create({
    accountId: ACCOUNT_ID,
    title: 'Aviso de atendimento',
    classification,
    origin: ContentOrigin.MANUAL,
    bodyBase: 'Olá {{primeiro_nome|amigo}}!',
    createdBy: AUTHOR_ID,
  });
}

function approver(name: string, email: string | null, phone: string | null = null): Approver {
  return Approver.create({
    accountId: ACCOUNT_ID,
    name,
    email: email ? Email.create(email) : null,
    phone: phone ? PhoneE164.create(phone) : null,
  });
}

describe('SubmitForApprovalUseCase (§8)', () => {
  let contents: jest.Mocked<ContentRepositoryPort>;
  let settings: jest.Mocked<ApprovalSettingsRepositoryPort>;
  let approvers: jest.Mocked<ApproverRepositoryPort>;
  let requests: jest.Mocked<ApprovalRequestRepositoryPort>;
  let authors: jest.Mocked<ContentAuthorProviderPort>;
  let notifier: jest.Mocked<SystemNotifierPort>;
  let unitOfWork: jest.Mocked<UnitOfWorkPort>;
  let audit: jest.Mocked<Pick<RecordAuditLogUseCase, 'execute'>>;
  let useCase: SubmitForApprovalUseCase;
  let content: Content;

  const command = new SubmitForApprovalCommand(
    ACCOUNT_ID,
    AUTHOR_ID,
    '00000000-0000-4000-8000-000000000000',
    '203.0.113.7',
  );

  beforeEach(() => {
    content = makeContent();

    contents = {
      findById: jest.fn(async () => content),
      save: jest.fn(async (c: Content) => c),
    } as unknown as jest.Mocked<ContentRepositoryPort>;

    settings = {
      find: jest.fn(async () => null),
      save: jest.fn(),
    } as unknown as jest.Mocked<ApprovalSettingsRepositoryPort>;

    approvers = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      listAll: jest.fn(),
      listActive: jest.fn(async () => [approver('Ana', 'ana@exemplo.com')]),
      save: jest.fn(),
    } as unknown as jest.Mocked<ApproverRepositoryPort>;

    requests = {
      findById: jest.fn(),
      listForContent: jest.fn(async () => []),
      saveMany: jest.fn(),
      save: jest.fn(),
      invalidatePendingForContent: jest.fn(),
      findByTokenHashUnscoped: jest.fn(),
    } as unknown as jest.Mocked<ApprovalRequestRepositoryPort>;

    authors = {
      emailOf: jest.fn(async () => AUTHOR_EMAIL),
    } as unknown as jest.Mocked<ContentAuthorProviderPort>;

    notifier = {
      notify: jest.fn(async () => ({ emailSent: true, whatsAppSent: false, failures: [] })),
    } as unknown as jest.Mocked<SystemNotifierPort>;

    unitOfWork = {
      execute: jest.fn(async (work: () => Promise<unknown>) => work()),
    } as unknown as jest.Mocked<UnitOfWorkPort>;

    audit = { execute: jest.fn() };

    useCase = new SubmitForApprovalUseCase(
      contents,
      settings,
      approvers,
      requests,
      authors,
      notifier,
      unitOfWork,
      audit as unknown as RecordAuditLogUseCase,
      new ConfigService({ APPROVAL_TOKEN_TTL_HOURS: 72, FRONTEND_URL: 'https://app.batuta.test/' }),
    );
  });

  it('moves the content to PENDING_APPROVAL and issues one request per approver', async () => {
    const result = await useCase.execute(command);

    expect(content.status).toBe(ContentStatus.PENDING_APPROVAL);
    expect(result.requestsCreated).toBe(1);
    expect(result.requiredApprovals).toBe(1);
    expect(requests.saveMany).toHaveBeenCalledTimes(1);
  });

  it('persists content and requests in ONE transaction, and notifies only after it', async () => {
    const order: string[] = [];
    unitOfWork.execute.mockImplementation(async (work: () => Promise<unknown>) => {
      order.push('transaction');
      return work();
    });
    notifier.notify.mockImplementation(async () => {
      order.push('notify');
      return { emailSent: true, whatsAppSent: false, failures: [] };
    });

    await useCase.execute(command);

    // A link that arrives for a submission that then failed to commit is worse than a resend.
    expect(order).toEqual(['transaction', 'notify']);
  });

  it('binds every request to the CURRENT content_hash (§8 item 4)', async () => {
    const hashAtSubmission = content.contentHash;

    await useCase.execute(command);

    const [issued] = requests.saveMany.mock.calls[0] as [ApprovalRequest[]];
    expect(issued).toHaveLength(1);
    expect(issued[0].contentHash).toBe(hashAtSubmission);
  });

  it('sends a link and nothing else — never the content text (§8 item 4)', async () => {
    await useCase.execute(command);

    const [notification] = notifier.notify.mock.calls[0];
    expect(notification.body).toContain('https://app.batuta.test/aprovacao/');
    // The body of the message must not be reviewable by WhatsApp reply: "aprovado 👍" is the weakest
    // possible evidence, which is the whole reason the magic link exists.
    expect(notification.body).not.toContain(content.bodyBase);
    expect(notification.body).toMatch(/uma vez/);
  });

  it('excludes the author, even when the author is also a registered approver (§8.5)', async () => {
    approvers.listActive.mockResolvedValue([
      approver('Autor', AUTHOR_EMAIL),
      approver('Ana', 'ana@exemplo.com'),
    ]);

    await useCase.execute(command);

    const [issued] = requests.saveMany.mock.calls[0] as [ApprovalRequest[]];
    const notified = notifier.notify.mock.calls.map(([n]) => n.recipientName);
    expect(issued).toHaveLength(1);
    expect(notified).toEqual(['Ana']);
  });

  it('refuses the submission when the ONLY approver is the author', async () => {
    approvers.listActive.mockResolvedValue([approver('Autor', AUTHOR_EMAIL)]);

    await expect(useCase.execute(command)).rejects.toThrow(ApproverCannotBeAuthorException);
    expect(content.status).toBe(ContentStatus.DRAFT);
    expect(requests.saveMany).not.toHaveBeenCalled();
  });

  it('refuses when there are no approvers at all', async () => {
    approvers.listActive.mockResolvedValue([]);

    await expect(useCase.execute(command)).rejects.toThrow(NoActiveApproverException);
  });

  it('electoral content requires two approvals by default, and 1 eligible approver is not enough', async () => {
    content = makeContent(ContentClassification.ELECTORAL);
    contents.findById.mockResolvedValue(content);

    await expect(useCase.execute(command)).rejects.toThrow(NotEnoughApproversException);
    // Refusing beats creating a submission that can never reach its threshold and stalls forever.
    expect(content.status).toBe(ContentStatus.DRAFT);
  });

  it('electoral content with two eligible approvers goes through, both notified', async () => {
    content = makeContent(ContentClassification.ELECTORAL);
    contents.findById.mockResolvedValue(content);
    approvers.listActive.mockResolvedValue([
      approver('Ana', 'ana@exemplo.com'),
      approver('Bruno', 'bruno@exemplo.com'),
    ]);

    const result = await useCase.execute(command);

    expect(result.requiredApprovals).toBe(2);
    expect(result.requestsCreated).toBe(2);
    expect(notifier.notify).toHaveBeenCalledTimes(2);
  });

  it('each request gets its OWN token — one leaked link cannot decide for both approvers', async () => {
    approvers.listActive.mockResolvedValue([
      approver('Ana', 'ana@exemplo.com'),
      approver('Bruno', 'bruno@exemplo.com'),
    ]);
    settings.find.mockResolvedValue(
      ApprovalSettings.reconstitute({
        id: 'ffffffff-1111-4111-8111-111111111111',
        accountId: ACCOUNT_ID,
        requiredForInstitutional: 2,
        requiredForElectoral: 2,
        notifyChannel: NotifyChannel.EMAIL,
      }),
    );

    await useCase.execute(command);

    const [issued] = requests.saveMany.mock.calls[0] as [ApprovalRequest[]];
    const hashes = issued.map((request) => request.tokenHashForPersistence());
    expect(new Set(hashes).size).toBe(2);
  });

  it('an approver the chosen channel cannot reach does not count towards the requirement', async () => {
    settings.find.mockResolvedValue(
      ApprovalSettings.reconstitute({
        id: 'ffffffff-1111-4111-8111-111111111111',
        accountId: ACCOUNT_ID,
        requiredForInstitutional: 2,
        requiredForElectoral: 2,
        notifyChannel: NotifyChannel.WHATSAPP,
      }),
    );
    approvers.listActive.mockResolvedValue([
      approver('Ana', null, '+5511988887777'),
      // E-mail only, but the account notifies by WhatsApp: unreachable for THIS submission.
      approver('Bruno', 'bruno@exemplo.com'),
    ]);

    await expect(useCase.execute(command)).rejects.toThrow(NotEnoughApproversException);
  });

  it('a notification failure is reported, never swallowed, and the submission stands', async () => {
    notifier.notify.mockResolvedValue({
      emailSent: false,
      whatsAppSent: false,
      failures: ['e-mail: conexão recusada'],
    });

    const result = await useCase.execute(command);

    expect(content.status).toBe(ContentStatus.PENDING_APPROVAL);
    expect(result.notificationFailures).toEqual(['Ana: e-mail: conexão recusada']);
    expect(result.notifiedApprovers).toEqual([]);
  });

  it('audits the submission with the hash, and never with a token', async () => {
    await useCase.execute(command);

    const [entry] = audit.execute.mock.calls[0] as [
      { action: AuditAction; payload: Record<string, unknown> },
    ];
    expect(entry.action).toBe(AuditAction.CONTENT_SUBMITTED_FOR_APPROVAL);
    expect(entry.payload.contentHash).toBe(content.contentHash);
    expect(entry.payload.requiredApprovals).toBe(1);

    const [notification] = notifier.notify.mock.calls[0];
    const token = notification.body.split('/aprovacao/')[1].split('\n')[0];
    expect(JSON.stringify(entry)).not.toContain(token);
  });
});
