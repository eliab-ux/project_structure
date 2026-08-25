import { Content } from '../../../src/contexts/content/domain/entities/content.entity';
import { ContentClassification } from '../../../src/contexts/content/domain/value-objects/content-classification.vo';
import { ContentOrigin } from '../../../src/contexts/content/domain/value-objects/content-origin.vo';
import { ContentStatus } from '../../../src/contexts/content/domain/value-objects/content-status.vo';
import { MediaKind } from '../../../src/contexts/content/domain/value-objects/media-kind.vo';
import {
  MAX_CAPTION_LENGTH,
  findAttachmentProblems,
} from '../../../src/contexts/content/domain/services/attachment-policy';

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = 'aaaaaaaa-1111-4111-8111-111111111111';

function draft(bodyBase = 'Olá {{primeiro_nome|amigo}}'): Content {
  return Content.create({
    accountId: ACCOUNT_ID,
    title: 'Aviso',
    classification: ContentClassification.INSTITUTIONAL,
    origin: ContentOrigin.MANUAL,
    bodyBase,
    createdBy: USER_ID,
  });
}

function attachImage(content: Content, variantId: string | null, name = 'foto.png'): void {
  content.attachMedia({
    variantId,
    kind: MediaKind.IMAGE,
    storageKey: `content-media/${name}`,
    mimeType: 'image/png',
    sizeBytes: 1024,
    originalName: name,
  });
}

describe('Content.mediaFor — which file goes with which body', () => {
  it('sends the content attachment when the variant has none of its own', () => {
    const content = draft();
    const variant = content.addVariant({ label: 'Norte', body: 'Oi', createdBy: USER_ID });
    attachImage(content, null, 'base.png');

    expect(content.mediaFor(variant.id).map((asset) => asset.originalName)).toEqual(['base.png']);
    expect(content.mediaFor(null).map((asset) => asset.originalName)).toEqual(['base.png']);
  });

  it('lets a variant override the content attachment instead of adding to it', () => {
    const content = draft();
    const variant = content.addVariant({ label: 'Norte', body: 'Oi', createdBy: USER_ID });
    attachImage(content, null, 'base.png');
    attachImage(content, variant.id, 'norte.png');

    // Overrides, never merges: an attachment on the content is a default, and a variant that brings
    // its own would otherwise silently send two files.
    expect(content.mediaFor(variant.id).map((asset) => asset.originalName)).toEqual(['norte.png']);
    expect(content.mediaFor(null).map((asset) => asset.originalName)).toEqual(['base.png']);
  });

  it('carries nothing when nothing is attached', () => {
    expect(draft().mediaFor(null)).toEqual([]);
  });
});

describe('Content.sendableBodies — o texto que realmente sai', () => {
  it('leaves the body untouched while the link is only provenance', () => {
    const content = draft('Promoção de quarta');
    content.changeSourceUrl('https://instagram.com/p/abc');

    expect(content.sendableBodies[0].body).toBe('Promoção de quarta');
  });

  it('appends the link on its own line once the content is set to send it', () => {
    const content = draft('Promoção de quarta');
    content.changeSourceUrl('https://instagram.com/p/abc');
    content.changeIncludeSourceUrl(true);

    // A blank line, so WhatsApp renders the URL as a clickable line of its own.
    expect(content.sendableBodies[0].body).toBe(
      'Promoção de quarta\n\nhttps://instagram.com/p/abc',
    );
  });

  it('appends it to every variant too — a variant is the whole message for its slice', () => {
    const content = draft('Base');
    content.addVariant({ label: 'Norte', body: 'Oi Norte', createdBy: USER_ID });
    content.changeSourceUrl('https://instagram.com/p/abc');
    content.changeIncludeSourceUrl(true);

    expect(content.sendableBodies.map((sendable) => sendable.body)).toEqual([
      'Base\n\nhttps://instagram.com/p/abc',
      'Oi Norte\n\nhttps://instagram.com/p/abc',
    ]);
  });

  it('sends nothing extra when the flag is on but there is no link', () => {
    const content = draft('Promoção de quarta');
    content.changeIncludeSourceUrl(true);

    expect(content.sendableBodies[0].body).toBe('Promoção de quarta');
  });
});

describe('the link and the approval — what costs a re-approval and what does not', () => {
  function approved(body = 'Promoção de quarta'): Content {
    const content = draft(body);
    content.submitForApproval();
    content.registerApproval(1, 1);
    return content;
  }

  it('keeps the approval when a provenance link is corrected', () => {
    const content = approved();
    const hash = content.contentHash;

    content.changeSourceUrl('https://instagram.com/p/corrigido');

    // Nobody receives it, so nothing anyone approved changed. This is the property the flag has to
    // preserve, not break.
    expect(content.status).toBe(ContentStatus.APPROVED);
    expect(content.contentHash).toBe(hash);
  });

  it('destroys the approval when the link starts going out', () => {
    const content = approved();
    content.changeSourceUrl('https://instagram.com/p/abc');

    content.changeIncludeSourceUrl(true);

    expect(content.status).toBe(ContentStatus.DRAFT);
    expect(content.approvedAt).toBeNull();
  });

  it('destroys the approval when a link that IS being sent is swapped', () => {
    const content = draft();
    content.changeSourceUrl('https://instagram.com/p/original');
    content.changeIncludeSourceUrl(true);
    content.submitForApproval();
    content.registerApproval(1, 1);

    content.changeSourceUrl('https://instagram.com/p/outro-destino');

    // The whole reason the link enters the hash: otherwise the approver signs off on one destination
    // and the base receives another, with nothing recording the swap.
    expect(content.status).toBe(ContentStatus.DRAFT);
  });

  it('destroys the approval when the link stops going out', () => {
    const content = draft();
    content.changeSourceUrl('https://instagram.com/p/abc');
    content.changeIncludeSourceUrl(true);
    content.submitForApproval();
    content.registerApproval(1, 1);

    content.changeIncludeSourceUrl(false);

    // Removing text from an approved message is still changing it.
    expect(content.status).toBe(ContentStatus.DRAFT);
  });

  it('counts the appended link against the caption limit', () => {
    const link = 'https://instagram.com/p/abcdefghij';
    const content = draft('x'.repeat(MAX_CAPTION_LENGTH - 2));
    content.changeSourceUrl(link);
    content.changeIncludeSourceUrl(true);
    attachImage(content, null);

    // The body alone fits; the body plus the link does not, and the contact receives both.
    const [problem] = findAttachmentProblems(content);

    expect(problem.reason).toContain(String(MAX_CAPTION_LENGTH));
  });
});

describe('findAttachmentProblems — one dispatch has to be one WhatsApp message', () => {
  it('approves a text-only content', () => {
    expect(findAttachmentProblems(draft())).toEqual([]);
  });

  it('approves one image with a short caption', () => {
    const content = draft();
    attachImage(content, null);

    expect(findAttachmentProblems(content)).toEqual([]);
  });

  it('refuses two attachments on the same body, naming both files', () => {
    const content = draft();
    attachImage(content, null, 'foto.png');
    attachImage(content, null, 'cartaz.png');

    const [problem, ...rest] = findAttachmentProblems(content);

    expect(rest).toEqual([]);
    expect(problem.label).toBe('Base');
    expect(problem.reason).toContain('foto.png');
    expect(problem.reason).toContain('cartaz.png');
  });

  it('refuses a body that exceeds the caption limit once it travels with media', () => {
    const content = draft('x'.repeat(MAX_CAPTION_LENGTH + 1));
    attachImage(content, null);

    const [problem] = findAttachmentProblems(content);

    expect(problem.reason).toContain(String(MAX_CAPTION_LENGTH));
  });

  it('allows the same long body when there is no media — a text message is not a caption', () => {
    expect(findAttachmentProblems(draft('x'.repeat(MAX_CAPTION_LENGTH + 1)))).toEqual([]);
  });

  it('points at the variant that is the problem, not at the content as a whole', () => {
    const content = draft();
    const north = content.addVariant({ label: 'Norte', body: 'Oi', createdBy: USER_ID });
    content.addVariant({ label: 'Sul', body: 'Olá', createdBy: USER_ID });
    attachImage(content, north.id, 'a.png');
    attachImage(content, north.id, 'b.png');

    const problems = findAttachmentProblems(content);

    expect(problems).toHaveLength(1);
    expect(problems[0].label).toBe('Norte');
  });
});
