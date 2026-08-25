import { InvalidateApprovalsOnContentChangeHandler } from '../../../src/contexts/approval/application/use-cases/invalidate-approvals/invalidate-approvals-on-content-change.handler';
import { ApprovalRequestRepositoryPort } from '../../../src/contexts/approval/application/ports/output/approval-repositories.port';
import { ContentApprovalInvalidatedEvent } from '../../../src/contexts/content/domain/events/content-approval-invalidated.event';
import { Content } from '../../../src/contexts/content/domain/entities/content.entity';
import { ContentId } from '../../../src/contexts/content/domain/value-objects/content-id.vo';
import { ContentClassification } from '../../../src/contexts/content/domain/value-objects/content-classification.vo';
import { ContentOrigin } from '../../../src/contexts/content/domain/value-objects/content-origin.vo';
import { ContentStatus } from '../../../src/contexts/content/domain/value-objects/content-status.vo';
import { ContentNotSubmittableException } from '../../../src/contexts/content/domain/exceptions/content-not-submittable.exception';
import { RecordAuditLogUseCase } from '../../../src/contexts/audit/application/use-cases/record-audit-log.use-case';
import { AuditAction } from '../../../src/contexts/audit/domain/value-objects/audit-action.vo';
import { TenantScopedJobRunner } from '../../../src/infrastructure/messaging/tenant-scoped-job.runner';

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const AUTHOR_ID = 'aaaaaaaa-1111-4111-8111-111111111111';
const CONTENT_ID = 'bbbbbbbb-1111-4111-8111-111111111111';

class FakeRunner {
  readonly scopes: string[] = [];

  async run<T>(accountId: string, work: () => Promise<T>): Promise<T> {
    this.scopes.push(accountId);
    return work();
  }
}

function contentIn(status: ContentStatus): Content {
  const draft = Content.create({
    accountId: ACCOUNT_ID,
    title: 'Aviso de atendimento',
    classification: ContentClassification.INSTITUTIONAL,
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
    status,
    contentHash: draft.contentHash,
    createdBy: AUTHOR_ID,
    approvedAt: status === ContentStatus.APPROVED ? new Date() : null,
    createdAt: new Date('2026-08-01T09:00:00Z'),
    variants: [],
    media: [],
  });
}

describe('Content — the FASE 5 transitions', () => {
  it('a DRAFT can be submitted, and lands in PENDING_APPROVAL', () => {
    const content = contentIn(ContentStatus.DRAFT);

    content.submitForApproval();

    expect(content.status).toBe(ContentStatus.PENDING_APPROVAL);
    expect(content.isDispatchable).toBe(false);
  });

  it('submitting twice is refused — the second submission would issue a parallel set of links', () => {
    const content = contentIn(ContentStatus.PENDING_APPROVAL);

    expect(() => content.submitForApproval()).toThrow(ContentNotSubmittableException);
  });

  it('an APPROVED content cannot be resubmitted', () => {
    const content = contentIn(ContentStatus.APPROVED);

    expect(() => content.submitForApproval()).toThrow();
    expect(content.status).toBe(ContentStatus.APPROVED);
  });

  it('registerApproval only flips when the threshold is reached', () => {
    const content = contentIn(ContentStatus.PENDING_APPROVAL);

    expect(content.registerApproval(1, 2)).toBe(false);
    expect(content.status).toBe(ContentStatus.PENDING_APPROVAL);

    expect(content.registerApproval(2, 2)).toBe(true);
    expect(content.status).toBe(ContentStatus.APPROVED);
    expect(content.approvedAt).toBeInstanceOf(Date);
  });

  it('registerApproval on a content that is not pending does nothing', () => {
    const content = contentIn(ContentStatus.DRAFT);

    // Defensive: a late decision on a content that already returned to DRAFT must not approve it.
    expect(content.registerApproval(5, 1)).toBe(false);
    expect(content.status).toBe(ContentStatus.DRAFT);
  });

  it('a rejection sends it to REJECTED and clears approvedAt', () => {
    const content = contentIn(ContentStatus.PENDING_APPROVAL);
    content.registerApproval(1, 1);
    expect(content.status).toBe(ContentStatus.APPROVED);

    const pending = contentIn(ContentStatus.PENDING_APPROVAL);
    pending.rejectApproval();

    expect(pending.status).toBe(ContentStatus.REJECTED);
    expect(pending.approvedAt).toBeNull();
  });

  it('a REJECTED content returns to DRAFT so the author can fix it', () => {
    const content = contentIn(ContentStatus.REJECTED);

    content.returnToDraft();

    expect(content.status).toBe(ContentStatus.DRAFT);
  });

  it('editing an APPROVED content invalidates the approval and returns it to DRAFT (§8.5)', () => {
    const content = contentIn(ContentStatus.APPROVED);
    const before = content.contentHash;

    content.changeBody('Olá {{primeiro_nome|vizinho}}, novidade!');

    expect(content.contentHash).not.toBe(before);
    expect(content.status).toBe(ContentStatus.DRAFT);
    expect(content.approvedAt).toBeNull();

    const events = content.pullDomainEvents().map((event) => event.constructor.name);
    expect(events).toContain('ContentApprovalInvalidatedEvent');
  });

  it('editing a PENDING_APPROVAL content does the same — links in flight die', () => {
    const content = contentIn(ContentStatus.PENDING_APPROVAL);

    content.changeBody('Outro texto {{primeiro_nome|amigo}}');

    expect(content.status).toBe(ContentStatus.DRAFT);
    const events = content.pullDomainEvents().map((event) => event.constructor.name);
    expect(events).toContain('ContentApprovalInvalidatedEvent');
  });
});

describe('InvalidateApprovalsOnContentChangeHandler (§8.5)', () => {
  let requests: jest.Mocked<ApprovalRequestRepositoryPort>;
  let audit: jest.Mocked<Pick<RecordAuditLogUseCase, 'execute'>>;
  let runner: FakeRunner;
  let handler: InvalidateApprovalsOnContentChangeHandler;

  const event = new ContentApprovalInvalidatedEvent(
    ACCOUNT_ID,
    CONTENT_ID,
    'a'.repeat(64),
    'b'.repeat(64),
    ContentStatus.APPROVED,
  );

  beforeEach(() => {
    requests = {
      findById: jest.fn(),
      listForContent: jest.fn(),
      saveMany: jest.fn(),
      save: jest.fn(),
      invalidatePendingForContent: jest.fn(async () => 2),
      findByTokenHashUnscoped: jest.fn(),
    } as unknown as jest.Mocked<ApprovalRequestRepositoryPort>;

    audit = { execute: jest.fn() };
    runner = new FakeRunner();

    handler = new InvalidateApprovalsOnContentChangeHandler(
      requests,
      runner as unknown as TenantScopedJobRunner,
      audit as unknown as RecordAuditLogUseCase,
    );
  });

  it('invalidates the pending requests inside the event’s tenant scope', async () => {
    await handler.handle(event);

    expect(runner.scopes).toEqual([ACCOUNT_ID]);
    expect(requests.invalidatePendingForContent).toHaveBeenCalledWith(CONTENT_ID);
  });

  it('audits with BOTH hashes, so "why did my link stop working?" has an exact answer', async () => {
    await handler.handle(event);

    const [entry] = audit.execute.mock.calls[0] as [
      { action: AuditAction; payload: Record<string, unknown> },
    ];
    expect(entry.action).toBe(AuditAction.CONTENT_APPROVALS_INVALIDATED);
    expect(entry.payload.previousHash).toBe('a'.repeat(64));
    expect(entry.payload.newHash).toBe('b'.repeat(64));
    expect(entry.payload.requestsInvalidated).toBe(2);
  });

  it('records nothing when there was nothing pending', async () => {
    requests.invalidatePendingForContent.mockResolvedValue(0);

    await handler.handle(event);

    expect(audit.execute).not.toHaveBeenCalled();
  });

  it('a failure never breaks the edit that triggered it', async () => {
    requests.invalidatePendingForContent.mockRejectedValue(new Error('banco fora'));

    // Swallowed on purpose: a stale PENDING row is inert, because assertUsable refuses it on the hash.
    await expect(handler.handle(event)).resolves.toBeUndefined();
  });
});
