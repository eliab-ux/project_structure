import { DecideApprovalUseCase } from '../../../src/contexts/approval/application/use-cases/decide-approval/decide-approval.use-case';
import { DecideApprovalCommand } from '../../../src/contexts/approval/application/use-cases/decide-approval/decide-approval.command';
import {
  ApprovalRequestRepositoryPort,
  ApprovalSettingsRepositoryPort,
  ApproverRepositoryPort,
} from '../../../src/contexts/approval/application/ports/output/approval-repositories.port';
import { ApprovalRequest } from '../../../src/contexts/approval/domain/entities/approval-request.entity';
import { ApprovalSettings } from '../../../src/contexts/approval/domain/entities/approval-settings.entity';
import { Approver } from '../../../src/contexts/approval/domain/entities/approver.entity';
import { ApprovalRequestStatus } from '../../../src/contexts/approval/domain/value-objects/approval-status.vo';
import { NotifyChannel } from '../../../src/contexts/approval/domain/value-objects/notify-channel.vo';
import { hashApprovalToken } from '../../../src/contexts/approval/domain/value-objects/approval-token.vo';
import { InvalidApprovalTokenException } from '../../../src/contexts/approval/domain/exceptions/invalid-approval-token.exception';
import { ContentRepositoryPort } from '../../../src/contexts/content/application/ports/output/content-repository.port';
import { Content } from '../../../src/contexts/content/domain/entities/content.entity';
import { ContentId } from '../../../src/contexts/content/domain/value-objects/content-id.vo';
import { ContentClassification } from '../../../src/contexts/content/domain/value-objects/content-classification.vo';
import { ContentOrigin } from '../../../src/contexts/content/domain/value-objects/content-origin.vo';
import { ContentStatus } from '../../../src/contexts/content/domain/value-objects/content-status.vo';
import { RecordAuditLogUseCase } from '../../../src/contexts/audit/application/use-cases/record-audit-log.use-case';
import {
  AuditAction,
  AuditActorType,
} from '../../../src/contexts/audit/domain/value-objects/audit-action.vo';
import { EventPublisherPort } from '../../../src/infrastructure/persistence/ports/event-publisher.port';
import { UnitOfWorkPort } from '../../../src/infrastructure/persistence/ports/unit-of-work.port';
import { TenantScopedJobRunner } from '../../../src/infrastructure/messaging/tenant-scoped-job.runner';
import { Email } from '../../../src/contexts/user/domain/value-objects/email.vo';

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ACCOUNT = '22222222-2222-4222-8222-222222222222';
const AUTHOR_ID = 'aaaaaaaa-1111-4111-8111-111111111111';
const CONTENT_ID = 'bbbbbbbb-1111-4111-8111-111111111111';
const APPROVER_A = 'cccccccc-1111-4111-8111-111111111111';
const APPROVER_B = 'cccccccc-2222-4222-8222-222222222222';

/** A pending content, as it comes back from the database after submission. */
function pendingContent(classification = ContentClassification.INSTITUTIONAL): Content {
  const draft = Content.create({
    accountId: ACCOUNT_ID,
    title: 'Aviso de atendimento',
    classification,
    origin: ContentOrigin.MANUAL,
    bodyBase: 'Olá {{primeiro_nome|amigo}}!',
    createdBy: AUTHOR_ID,
  });
  return Content.reconstitute({
    id: ContentId.from(CONTENT_ID),
    accountId: ACCOUNT_ID,
    title: draft.title,
    classification: draft.classification,
    origin: draft.origin,
    bodyBase: draft.bodyBase,
    sourceUrl: null,
    includeSourceUrl: false,
    status: ContentStatus.PENDING_APPROVAL,
    contentHash: draft.contentHash,
    createdBy: AUTHOR_ID,
    approvedAt: null,
    createdAt: new Date('2026-08-01T09:00:00Z'),
    variants: [],
    media: [],
  });
}

function storedRequest(params: {
  id: string;
  approverId: string;
  contentHash: string;
  status?: ApprovalRequestStatus;
  accountId?: string;
  expiresAt?: Date;
}): ApprovalRequest {
  return ApprovalRequest.reconstitute({
    id: params.id,
    accountId: params.accountId ?? ACCOUNT_ID,
    contentId: CONTENT_ID,
    contentHash: params.contentHash,
    approverId: params.approverId,
    tokenHash: hashApprovalToken(`token-${params.id}`),
    expiresAt: params.expiresAt ?? new Date(Date.now() + 3_600_000),
    status: params.status ?? ApprovalRequestStatus.PENDING,
    decidedAt: params.status === ApprovalRequestStatus.APPROVED ? new Date() : null,
    decidedIp: null,
    decidedUserAgent: null,
    comment: null,
    createdAt: new Date(),
  });
}

/** Stands in for the real runner: records the accountId it was scoped with, then runs the work. */
class FakeRunner {
  readonly scopes: string[] = [];

  async run<T>(accountId: string, work: () => Promise<T>): Promise<T> {
    if (!accountId) {
      throw new Error('Job sem accountId: escopo de tenant não pode ser estabelecido.');
    }
    this.scopes.push(accountId);
    return work();
  }
}

describe('DecideApprovalUseCase (§8 item 4, §8.5)', () => {
  let requests: jest.Mocked<ApprovalRequestRepositoryPort>;
  let settings: jest.Mocked<ApprovalSettingsRepositoryPort>;
  let approvers: jest.Mocked<ApproverRepositoryPort>;
  let contents: jest.Mocked<ContentRepositoryPort>;
  let events: jest.Mocked<EventPublisherPort>;
  let unitOfWork: jest.Mocked<UnitOfWorkPort>;
  let audit: jest.Mocked<Pick<RecordAuditLogUseCase, 'execute'>>;
  let runner: FakeRunner;
  let useCase: DecideApprovalUseCase;
  let content: Content;
  let request: ApprovalRequest;

  function twoApprovalsRequired(): void {
    settings.find.mockResolvedValue(
      ApprovalSettings.reconstitute({
        id: 'ffffffff-1111-4111-8111-111111111111',
        accountId: ACCOUNT_ID,
        requiredForInstitutional: 2,
        requiredForElectoral: 2,
        notifyChannel: NotifyChannel.EMAIL,
      }),
    );
  }

  beforeEach(() => {
    content = pendingContent();
    request = storedRequest({
      id: APPROVER_A,
      approverId: APPROVER_A,
      contentHash: content.contentHash,
    });

    requests = {
      findById: jest.fn(),
      listForContent: jest.fn(async () => [request]),
      saveMany: jest.fn(),
      save: jest.fn(async (r: ApprovalRequest) => r),
      invalidatePendingForContent: jest.fn(),
      findByTokenHashUnscoped: jest.fn(async () => request),
    } as unknown as jest.Mocked<ApprovalRequestRepositoryPort>;

    settings = {
      find: jest.fn(async () => null),
      save: jest.fn(),
    } as unknown as jest.Mocked<ApprovalSettingsRepositoryPort>;

    approvers = {
      findById: jest.fn(async () =>
        Approver.create({
          accountId: ACCOUNT_ID,
          name: 'Ana',
          email: Email.create('ana@exemplo.com'),
          phone: null,
        }),
      ),
      findByEmail: jest.fn(),
      listAll: jest.fn(),
      listActive: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<ApproverRepositoryPort>;

    contents = {
      findById: jest.fn(async () => content),
      save: jest.fn(async (c: Content) => c),
    } as unknown as jest.Mocked<ContentRepositoryPort>;

    events = {
      publish: jest.fn(),
      publishAll: jest.fn(),
    } as unknown as jest.Mocked<EventPublisherPort>;

    unitOfWork = {
      execute: jest.fn(async (work: () => Promise<unknown>) => work()),
    } as unknown as jest.Mocked<UnitOfWorkPort>;

    audit = { execute: jest.fn() };
    runner = new FakeRunner();

    useCase = new DecideApprovalUseCase(
      requests,
      settings,
      approvers,
      contents,
      events,
      unitOfWork,
      runner as unknown as TenantScopedJobRunner,
      audit as unknown as RecordAuditLogUseCase,
    );
  });

  const approveCommand = new DecideApprovalCommand(
    'token-cccccccc-1111-4111-8111-111111111111',
    'APPROVE',
    null,
    '203.0.113.7',
    'iPhone',
  );

  it('one required approval: a single APPROVE flips the content to APPROVED', async () => {
    const result = await useCase.execute(approveCommand);

    expect(content.status).toBe(ContentStatus.APPROVED);
    expect(content.isDispatchable).toBe(true);
    expect(result.contentApproved).toBe(true);
    expect(result.approvalsSoFar).toBe(1);
    expect(result.requiredApprovals).toBe(1);
  });

  it('two required: the FIRST approval does not flip the content', async () => {
    twoApprovalsRequired();

    const result = await useCase.execute(approveCommand);

    expect(request.status).toBe(ApprovalRequestStatus.APPROVED);
    // The request is decided, but the content stays pending — this is the §8.5 invariant.
    expect(content.status).toBe(ContentStatus.PENDING_APPROVAL);
    expect(result.contentApproved).toBe(false);
    expect(result.approvalsSoFar).toBe(1);
    expect(result.requiredApprovals).toBe(2);
  });

  it('two required: the SECOND approval flips it', async () => {
    twoApprovalsRequired();
    const first = storedRequest({
      id: APPROVER_B,
      approverId: APPROVER_B,
      contentHash: content.contentHash,
      status: ApprovalRequestStatus.APPROVED,
    });
    requests.listForContent.mockResolvedValue([first, request]);

    const result = await useCase.execute(approveCommand);

    expect(content.status).toBe(ContentStatus.APPROVED);
    expect(result.approvalsSoFar).toBe(2);
  });

  it('an approval on an OLDER version does not count towards the current one', async () => {
    twoApprovalsRequired();
    const staleApproval = storedRequest({
      id: APPROVER_B,
      approverId: APPROVER_B,
      contentHash: 'b'.repeat(64), // a version that has since been edited
      status: ApprovalRequestStatus.APPROVED,
    });
    requests.listForContent.mockResolvedValue([staleApproval, request]);

    const result = await useCase.execute(approveCommand);

    // Counting it would tell the author they are done when the second reviewer never saw this text.
    expect(result.approvalsSoFar).toBe(1);
    expect(content.status).toBe(ContentStatus.PENDING_APPROVAL);
  });

  it('one rejection is enough: the content goes to REJECTED even with 2 required', async () => {
    twoApprovalsRequired();
    const rejectCommand = new DecideApprovalCommand(
      'token',
      'REJECT',
      'Trocar "obra" por "reforma".',
      '203.0.113.7',
      null,
    );

    const result = await useCase.execute(rejectCommand);

    expect(content.status).toBe(ContentStatus.REJECTED);
    expect(result.contentRejected).toBe(true);
    expect(request.comment).toBe('Trocar "obra" por "reforma".');
  });

  it('an unknown token is refused, and nothing is read or written afterwards', async () => {
    requests.findByTokenHashUnscoped.mockResolvedValue(null);

    await expect(useCase.execute(approveCommand)).rejects.toThrow(InvalidApprovalTokenException);
    expect(contents.findById).not.toHaveBeenCalled();
    expect(requests.save).not.toHaveBeenCalled();
    // No token, no tenant scope: nothing ran inside an account.
    expect(runner.scopes).toEqual([]);
  });

  it('single use: a second decision on the same request is refused', async () => {
    await useCase.execute(approveCommand);
    requests.save.mockClear();

    await expect(useCase.execute(approveCommand)).rejects.toThrow(/já foi registrada/i);
    expect(requests.save).not.toHaveBeenCalled();
  });

  it('an expired link is refused (TTL, §8 item 4)', async () => {
    request = storedRequest({
      id: APPROVER_A,
      approverId: APPROVER_A,
      contentHash: content.contentHash,
      expiresAt: new Date(Date.now() - 1_000),
    });
    requests.findByTokenHashUnscoped.mockResolvedValue(request);

    await expect(useCase.execute(approveCommand)).rejects.toThrow(/prazo/i);
    expect(content.status).toBe(ContentStatus.PENDING_APPROVAL);
  });

  it('a link whose content was edited is refused (§8.5)', async () => {
    request = storedRequest({
      id: APPROVER_A,
      approverId: APPROVER_A,
      contentHash: 'b'.repeat(64),
    });
    requests.findByTokenHashUnscoped.mockResolvedValue(request);

    await expect(useCase.execute(approveCommand)).rejects.toThrow(/editado/i);
  });

  it('the tenant scope comes from the TOKEN, not from the caller', async () => {
    request = storedRequest({
      id: APPROVER_A,
      approverId: APPROVER_A,
      contentHash: content.contentHash,
      accountId: OTHER_ACCOUNT,
    });
    requests.findByTokenHashUnscoped.mockResolvedValue(request);

    await useCase.execute(approveCommand).catch(() => undefined);

    // The whole point: the caller sent only a token, and the account was derived from the row it hit.
    expect(runner.scopes).toEqual([OTHER_ACCOUNT]);
  });

  it('everything except the token lookup runs inside a tenant scope', async () => {
    await useCase.execute(approveCommand);

    expect(runner.scopes).toEqual([ACCOUNT_ID]);
    // The lookup itself happened before the scope existed — that is the documented exception.
    expect(requests.findByTokenHashUnscoped).toHaveBeenCalledTimes(1);
  });

  it('audits as SYSTEM, with the version and the comment, because the approver has no account', async () => {
    const rejectCommand = new DecideApprovalCommand(
      'token',
      'REJECT',
      'Não autorizo.',
      '198.51.100.9',
      null,
    );

    await useCase.execute(rejectCommand);

    const [entry] = audit.execute.mock.calls[0] as [
      {
        action: AuditAction;
        actorType: AuditActorType;
        actorId: string | null;
        ip: string | null;
        payload: Record<string, unknown>;
      },
    ];
    expect(entry.action).toBe(AuditAction.CONTENT_APPROVAL_REJECTED);
    expect(entry.actorType).toBe(AuditActorType.SYSTEM);
    expect(entry.actorId).toBeNull();
    expect(entry.ip).toBe('198.51.100.9');
    expect(entry.payload.contentHash).toBe(content.contentHash);
    expect(entry.payload.approverName).toBe('Ana');
    expect(entry.payload.comment).toBe('Não autorizo.');
  });

  it('publishes the decision event and, on completion, the content-approved event', async () => {
    await useCase.execute(approveCommand);

    expect(events.publishAll).toHaveBeenCalledTimes(1);
    const published = events.publish.mock.calls.map(([event]) => event.constructor.name);
    expect(published).toContain('ContentApprovedEvent');
  });

  it('does not publish content-approved when the threshold was not reached', async () => {
    twoApprovalsRequired();

    await useCase.execute(approveCommand);

    const published = events.publish.mock.calls.map(([event]) => event.constructor.name);
    expect(published).not.toContain('ContentApprovedEvent');
  });
});
