import { ApprovalPageDto } from '../../../src/contexts/approval/application/dto/approval.dto';
import { ApprovalPageResponseDto } from '../../../src/infrastructure/http/controllers/approval/dto/approval-response.dto';

/**
 * Guards against the one bug this mapping style cannot fail to compile with: a field declared on the
 * response and never copied in `from()`.
 *
 * It is invisible to TypeScript — `sourceUrl!: string | null` asserts the field will be assigned, so
 * forgetting the assignment type-checks fine and ships `undefined`. That is exactly what happened: the
 * approval page declared `sourceUrl`, never mapped it, and the approver saw no provenance link while
 * the content clearly had one. The symptom appeared two screens away from the cause.
 *
 * The manual field-by-field mapping stays — it is what keeps a password hash from reaching a browser
 * through a spread. This test just makes the omission loud.
 */
function fullPage(): ApprovalPageDto {
  const dto = new ApprovalPageDto();
  dto.approverName = 'Ana';
  dto.contentTitle = 'Aviso';
  dto.classification = 'ELECTORAL';
  dto.contentHash = 'a'.repeat(64);
  dto.bodyBase = 'Olá {{primeiro_nome|amigo}}';
  dto.sourceUrl = 'https://instagram.com/p/abc';
  dto.includeSourceUrl = true;
  dto.variants = [{ label: 'Norte', body: 'Oi' }];
  dto.media = [
    { id: 'm1', kind: 'IMAGE', originalName: 'a.png', downloadUrl: '/api/public/x/media/m1' },
  ];
  dto.renderedSamples = [{ label: 'Base', renderedBody: 'Olá Ana', usedFallback: false }];
  dto.expiresAt = new Date('2026-08-10T12:00:00Z');
  dto.requiredApprovals = 2;
  dto.approvalsSoFar = 1;
  return dto;
}

describe('ApprovalPageResponseDto.from', () => {
  it('copies EVERY field — a declared field left unmapped ships as undefined', () => {
    const source = fullPage();

    const response = ApprovalPageResponseDto.from(source);

    for (const key of Object.keys(source) as (keyof ApprovalPageDto)[]) {
      expect({ key, value: response[key as keyof ApprovalPageResponseDto] }).toEqual({
        key,
        value: source[key],
      });
    }
  });

  it('carries the provenance link, which is what the approver checks the content against', () => {
    const response = ApprovalPageResponseDto.from(fullPage());

    expect(response.sourceUrl).toBe('https://instagram.com/p/abc');
  });

  it('keeps a null source url null rather than dropping the key', () => {
    const source = fullPage();
    source.sourceUrl = null;

    const response = ApprovalPageResponseDto.from(source);

    // `null` and `undefined` look the same on screen but not to a client that distinguishes
    // "no link" from "the API forgot to send it".
    expect(response.sourceUrl).toBeNull();
  });
});
