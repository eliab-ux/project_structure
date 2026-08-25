import { Content } from '../../../src/contexts/content/domain/entities/content.entity';
import { ContentClassification } from '../../../src/contexts/content/domain/value-objects/content-classification.vo';
import { ContentOrigin } from '../../../src/contexts/content/domain/value-objects/content-origin.vo';
import { ContentStatus } from '../../../src/contexts/content/domain/value-objects/content-status.vo';
import { ContentId } from '../../../src/contexts/content/domain/value-objects/content-id.vo';
import { MediaKind } from '../../../src/contexts/content/domain/value-objects/media-kind.vo';
import { ContentVariant } from '../../../src/contexts/content/domain/entities/content-variant.entity';
import { InvalidMergeFieldException } from '../../../src/contexts/content/domain/exceptions/invalid-merge-field.exception';
import { ContentNotEditableException } from '../../../src/contexts/content/domain/exceptions/content-not-editable.exception';
import { DuplicateVariantLabelException } from '../../../src/contexts/content/domain/exceptions/duplicate-variant-label.exception';
import { VariantNotFoundException } from '../../../src/contexts/content/domain/exceptions/variant-not-found.exception';

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = 'aaaaaaaa-1111-4111-8111-111111111111';
const CONTENT_ID = 'bbbbbbbb-1111-4111-8111-111111111111';

function makeContent(body = 'Olá {{primeiro_nome|amigo}}!'): Content {
  return Content.create({
    accountId: ACCOUNT_ID,
    title: 'Aviso de atendimento',
    classification: ContentClassification.INSTITUTIONAL,
    origin: ContentOrigin.MANUAL,
    bodyBase: body,
    createdBy: USER_ID,
  });
}

/** An approved content, as it would come back from the database in FASE 5. */
function approvedContent(body = 'Olá {{primeiro_nome|amigo}}!'): Content {
  const draft = makeContent(body);
  return Content.reconstitute({
    id: ContentId.from(CONTENT_ID),
    accountId: ACCOUNT_ID,
    title: draft.title,
    classification: draft.classification,
    origin: draft.origin,
    bodyBase: draft.bodyBase,
    sourceUrl: null,
    includeSourceUrl: false,
    status: ContentStatus.APPROVED,
    contentHash: draft.contentHash,
    createdBy: USER_ID,
    approvedAt: new Date('2026-08-01T10:00:00Z'),
    createdAt: new Date('2026-08-01T09:00:00Z'),
    variants: [],
    media: [],
  });
}

describe('Content — creation', () => {
  it('is born in DRAFT, classified, and not dispatchable', () => {
    const content = makeContent();

    expect(content.status).toBe(ContentStatus.DRAFT);
    expect(content.classification).toBe(ContentClassification.INSTITUTIONAL);
    expect(content.isDispatchable).toBe(false);
  });

  it('computes a hash at creation', () => {
    expect(makeContent().contentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('REFUSES a body whose merge field has no fallback (§7.4)', () => {
    expect(() => makeContent('Olá {{primeiro_nome}}!')).toThrow(InvalidMergeFieldException);
  });

  it('REFUSES an unknown merge field', () => {
    expect(() => makeContent('Olá {{cidade|aqui}}!')).toThrow(InvalidMergeFieldException);
  });

  it('accepts a body with no merge field', () => {
    expect(() => makeContent('Comunicado geral.')).not.toThrow();
  });

  it('keeps source_url as metadata only', () => {
    const content = Content.create({
      accountId: ACCOUNT_ID,
      title: 'Post',
      classification: ContentClassification.ELECTORAL,
      origin: ContentOrigin.MANUAL,
      bodyBase: 'Texto',
      sourceUrl: 'https://instagram.com/p/abc',
      createdBy: USER_ID,
    });

    expect(content.sourceUrl).toBe('https://instagram.com/p/abc');
  });
});

describe('Content — content_hash (§7 item 6)', () => {
  it('changes when the body changes', () => {
    const content = makeContent();
    const before = content.contentHash;

    content.changeBody('Outro texto para {{primeiro_nome|amigo}}');

    expect(content.contentHash).not.toBe(before);
  });

  it('changes when a variant is added', () => {
    const content = makeContent();
    const before = content.contentHash;

    content.addVariant({
      label: 'Zona Sul',
      body: 'Oi {{primeiro_nome|vizinho}}',
      createdBy: USER_ID,
    });

    expect(content.contentHash).not.toBe(before);
  });

  it('changes when media is attached', () => {
    const content = makeContent();
    const before = content.contentHash;

    content.attachMedia({
      variantId: null,
      kind: MediaKind.IMAGE,
      storageKey: 'contents/x/y.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 1024,
      originalName: 'foto.jpg',
    });

    expect(content.contentHash).not.toBe(before);
  });

  it('does NOT change when the title changes — the message is the same', () => {
    const content = makeContent();
    const before = content.contentHash;

    content.changeTitle('Outro título interno');

    expect(content.contentHash).toBe(before);
  });

  it('does NOT change when source_url changes — provenance is metadata', () => {
    const content = makeContent();
    const before = content.contentHash;

    content.changeSourceUrl('https://instagram.com/p/xyz');

    expect(content.contentHash).toBe(before);
  });

  it('is stable: the same content produces the same hash', () => {
    // Without this, every save would invalidate an approval and §8.5 would be noise.
    const a = makeContent();
    const b = makeContent();

    expect(a.contentHash).toBe(b.contentHash);
  });

  it('is order-independent for media', () => {
    const first = makeContent();
    const second = makeContent();

    const assets = [
      { key: 'a.jpg', mime: 'image/jpeg' },
      { key: 'b.png', mime: 'image/png' },
    ];
    for (const asset of assets) {
      first.attachMedia({
        variantId: null,
        kind: MediaKind.IMAGE,
        storageKey: asset.key,
        mimeType: asset.mime,
        sizeBytes: 10,
        originalName: asset.key,
      });
    }
    for (const asset of [...assets].reverse()) {
      second.attachMedia({
        variantId: null,
        kind: MediaKind.IMAGE,
        storageKey: asset.key,
        mimeType: asset.mime,
        sizeBytes: 10,
        originalName: asset.key,
      });
    }

    expect(first.contentHash).toBe(second.contentHash);
  });

  it('differs between classifications, even with identical text', () => {
    const institutional = makeContent();
    const electoral = Content.create({
      accountId: ACCOUNT_ID,
      title: 'Aviso de atendimento',
      classification: ContentClassification.ELECTORAL,
      origin: ContentOrigin.MANUAL,
      bodyBase: institutional.bodyBase,
      createdBy: USER_ID,
    });

    // An approver signed off on a message AS institutional; the same words as electoral is not it.
    expect(electoral.contentHash).not.toBe(institutional.contentHash);
  });
});

describe('Content — approval invalidation (§8.5)', () => {
  it('an edit sends an APPROVED content back to DRAFT and emits the event', () => {
    const content = approvedContent();

    content.changeBody('Texto novo para {{primeiro_nome|amigo}}');

    expect(content.status).toBe(ContentStatus.DRAFT);
    expect(content.approvedAt).toBeNull();
    const events = content.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0].eventName).toBe('content.approval_invalidated');
  });

  it('adding a variant to an approved content invalidates it too', () => {
    const content = approvedContent();

    content.addVariant({ label: 'Norte', body: 'Oi {{primeiro_nome|amigo}}', createdBy: USER_ID });

    expect(content.status).toBe(ContentStatus.DRAFT);
    expect(content.pullDomainEvents()).toHaveLength(1);
  });

  it('attaching media to an approved content invalidates it', () => {
    const content = approvedContent();

    content.attachMedia({
      variantId: null,
      kind: MediaKind.IMAGE,
      storageKey: 'k.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 100,
      originalName: 'k.jpg',
    });

    // The approver signed off on a message WITH (or without) that image.
    expect(content.status).toBe(ContentStatus.DRAFT);
  });

  it('a no-op save does NOT invalidate an approval', () => {
    const content = approvedContent();

    content.changeBody(content.bodyBase);

    expect(content.status).toBe(ContentStatus.APPROVED);
    expect(content.pullDomainEvents()).toHaveLength(0);
  });

  it('a title change does NOT invalidate an approval', () => {
    const content = approvedContent();

    content.changeTitle('Novo título só interno');

    expect(content.status).toBe(ContentStatus.APPROVED);
    expect(content.pullDomainEvents()).toHaveLength(0);
  });

  it('reviewing a variant does NOT invalidate an approval', () => {
    const approved = Content.reconstitute({
      id: ContentId.from(CONTENT_ID),
      accountId: ACCOUNT_ID,
      title: 'T',
      classification: ContentClassification.INSTITUTIONAL,
      origin: ContentOrigin.MANUAL,
      bodyBase: 'Texto',
      sourceUrl: null,
      includeSourceUrl: false,
      status: ContentStatus.APPROVED,
      contentHash: 'x',
      createdBy: USER_ID,
      approvedAt: new Date(),
      createdAt: new Date(),
      variants: [
        ContentVariant.reconstitute({
          id: 'cccccccc-1111-4111-8111-111111111111',
          label: 'Sul',
          body: 'Oi',
          position: 0,
          createdBy: USER_ID,
          reviewedBy: null,
        }),
      ],
      media: [],
    });

    approved.markVariantReviewed('cccccccc-1111-4111-8111-111111111111', USER_ID);

    expect(approved.status).toBe(ContentStatus.APPROVED);
    expect(approved.variants[0].reviewedBy).toBe(USER_ID);
  });

  it('an edit to a DRAFT emits nothing — there was no approval to destroy', () => {
    const content = makeContent();

    content.changeBody('Outro texto');

    expect(content.status).toBe(ContentStatus.DRAFT);
    expect(content.pullDomainEvents()).toHaveLength(0);
  });
});

describe('Content — variants (§7 item 5)', () => {
  it('records the human author, and no review yet', () => {
    const content = makeContent();

    const variant = content.addVariant({
      label: 'Zona Sul',
      body: 'Oi {{primeiro_nome|vizinho}}',
      createdBy: USER_ID,
    });

    // §2 forbids automatic generation; these columns are what makes the human authorship checkable.
    expect(variant.createdBy).toBe(USER_ID);
    expect(variant.reviewedBy).toBeNull();
  });

  it('refuses a duplicate label', () => {
    const content = makeContent();
    content.addVariant({ label: 'Sul', body: 'A', createdBy: USER_ID });

    expect(() => content.addVariant({ label: ' sul ', body: 'B', createdBy: USER_ID })).toThrow(
      DuplicateVariantLabelException,
    );
  });

  it('validates merge fields in a variant body too', () => {
    const content = makeContent();

    expect(() =>
      content.addVariant({ label: 'Sul', body: 'Oi {{primeiro_nome}}', createdBy: USER_ID }),
    ).toThrow(InvalidMergeFieldException);
  });

  it('editing a variant clears its previous review', () => {
    const content = makeContent();
    const variant = content.addVariant({ label: 'Sul', body: 'A', createdBy: USER_ID });
    content.markVariantReviewed(variant.id, 'reviewer-1');

    content.changeVariantBody(variant.id, 'B');

    // What was reviewed is no longer what is there.
    expect(content.variants[0].reviewedBy).toBeNull();
  });

  it('removing a variant takes its media with it', () => {
    const content = makeContent();
    const variant = content.addVariant({ label: 'Sul', body: 'A', createdBy: USER_ID });
    content.attachMedia({
      variantId: variant.id,
      kind: MediaKind.IMAGE,
      storageKey: 'k.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 10,
      originalName: 'k.jpg',
    });

    content.removeVariant(variant.id);

    // An orphan asset would still be counted in the hash.
    expect(content.variants).toHaveLength(0);
    expect(content.media).toHaveLength(0);
  });

  it('renumbers positions after a removal', () => {
    const content = makeContent();
    const first = content.addVariant({ label: 'A', body: 'a', createdBy: USER_ID });
    content.addVariant({ label: 'B', body: 'b', createdBy: USER_ID });
    content.addVariant({ label: 'C', body: 'c', createdBy: USER_ID });

    content.removeVariant(first.id);

    expect(content.variants.map((variant) => variant.position)).toEqual([0, 1]);
  });

  it('throws for an unknown variant', () => {
    expect(() => makeContent().removeVariant('dddddddd-1111-4111-8111-111111111111')).toThrow(
      VariantNotFoundException,
    );
  });

  it('sendableBodies covers the base and every variant', () => {
    const content = makeContent('Base {{primeiro_nome|amigo}}');
    content.addVariant({ label: 'Sul', body: 'Sul {{primeiro_nome|vizinho}}', createdBy: USER_ID });

    const bodies = content.sendableBodies;

    expect(bodies).toHaveLength(2);
    expect(bodies[0]).toEqual({
      variantId: null,
      label: 'Base',
      body: 'Base {{primeiro_nome|amigo}}',
    });
    expect(bodies[1].label).toBe('Sul');
  });
});

describe('Content — responding to a rejection', () => {
  function rejectedContent(body = 'Olá {{primeiro_nome|amigo}}!'): Content {
    const draft = makeContent(body);
    return Content.reconstitute({
      id: ContentId.from(CONTENT_ID),
      accountId: ACCOUNT_ID,
      title: draft.title,
      classification: draft.classification,
      origin: draft.origin,
      bodyBase: draft.bodyBase,
      sourceUrl: null,
      includeSourceUrl: false,
      status: ContentStatus.REJECTED,
      contentHash: draft.contentHash,
      createdBy: USER_ID,
      approvedAt: null,
      createdAt: new Date('2026-08-01T09:00:00Z'),
      variants: [],
      media: [],
    });
  }

  it('editing a REJECTED content returns it to DRAFT', () => {
    // Without this, rejection is a dead end: the author fixes what the approver pointed at, the
    // content stays REJECTED, and `submitForApproval` demands DRAFT — so the corrected text has no
    // way back into approval. Editing IS how one answers a rejection.
    const content = rejectedContent();

    content.changeBody('Texto corrigido para {{primeiro_nome|amigo}}');

    expect(content.status).toBe(ContentStatus.DRAFT);
  });

  it('and emits no invalidation event — there was no approval to invalidate', () => {
    const content = rejectedContent();

    content.changeBody('Texto corrigido para {{primeiro_nome|amigo}}');

    expect(content.pullDomainEvents()).toHaveLength(0);
  });

  it('after the edit it can be submitted again', () => {
    const content = rejectedContent();
    content.changeBody('Texto corrigido para {{primeiro_nome|amigo}}');

    expect(() => content.submitForApproval()).not.toThrow();
    expect(content.status).toBe(ContentStatus.PENDING_APPROVAL);
  });

  it('returnToDraft unlocks resubmission WITHOUT touching the hash', () => {
    // For the author who disagrees and resubmits the same words after a conversation. A cosmetic
    // edit to unlock it would change the hash, and the hash means "exactly these words".
    const content = rejectedContent();
    const hashBefore = content.contentHash;

    content.returnToDraft();

    expect(content.status).toBe(ContentStatus.DRAFT);
    expect(content.contentHash).toBe(hashBefore);
    expect(() => content.submitForApproval()).not.toThrow();
  });

  it('returnToDraft is a no-op on anything that is not REJECTED', () => {
    const approved = approvedContent();

    approved.returnToDraft();

    expect(approved.status).toBe(ContentStatus.APPROVED);
  });

  it('a no-op save does not resurrect a rejection', () => {
    // Saving the same words changes no hash, so nothing happened — and a content that was rejected
    // must not quietly become a draft because someone opened the screen and pressed save.
    const content = rejectedContent();

    content.changeBody(content.bodyBase);

    expect(content.status).toBe(ContentStatus.REJECTED);
  });
});

describe('Content — archiving', () => {
  it('makes the content read-only forever', () => {
    const content = makeContent();

    content.archive();

    expect(content.status).toBe(ContentStatus.ARCHIVED);
    expect(() => content.changeBody('x')).toThrow(ContentNotEditableException);
    expect(() => content.changeTitle('x')).toThrow(ContentNotEditableException);
    expect(() => content.addVariant({ label: 'x', body: 'y', createdBy: USER_ID })).toThrow(
      ContentNotEditableException,
    );
    expect(() => content.archive()).toThrow(ContentNotEditableException);
  });

  it('there is no delete on the aggregate — archived content is audit evidence', () => {
    const destructive = Object.getOwnPropertyNames(Content.prototype).filter((name) =>
      /^(delete|destroy|purge|erase)/i.test(name),
    );
    expect(destructive).toEqual([]);
  });
});

describe('Content — no path sets APPROVED', () => {
  it('the aggregate exposes no approve method — that is FASE 5, through a magic link', () => {
    const methods = Object.getOwnPropertyNames(Content.prototype);

    expect(methods).not.toContain('approve');
    expect(methods).not.toContain('markApproved');
    // Methods only: the `approvedAt` getter merely exposes a date FASE 5 will set.
    const approveMethods = methods
      .filter((name) => /approve/i.test(name))
      .filter(
        (name) =>
          typeof Object.getOwnPropertyDescriptor(Content.prototype, name)?.value === 'function',
      );
    expect(approveMethods).toEqual([]);
  });
});
