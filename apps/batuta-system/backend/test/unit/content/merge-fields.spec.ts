import {
  hasMergeFields,
  parseMergeFields,
  renderMergeFields,
  validateMergeFields,
} from '../../../src/contexts/content/domain/services/merge-fields';

describe('parseMergeFields', () => {
  it('finds a field with its fallback', () => {
    const fields = parseMergeFields('Olá {{primeiro_nome|amigo}}, tudo bem?');

    expect(fields).toEqual([
      expect.objectContaining({
        raw: '{{primeiro_nome|amigo}}',
        name: 'primeiro_nome',
        fallback: 'amigo',
      }),
    ]);
  });

  it('tolerates the spacing a human actually types', () => {
    const fields = parseMergeFields('{{ primeiro_nome | vizinho }}');

    expect(fields[0].name).toBe('primeiro_nome');
    expect(fields[0].fallback).toBe('vizinho');
  });

  it('distinguishes "no fallback" from "empty fallback"', () => {
    // Different mistakes deserve different messages.
    expect(parseMergeFields('{{primeiro_nome}}')[0].fallback).toBeNull();
    expect(parseMergeFields('{{primeiro_nome|}}')[0].fallback).toBe('');
  });

  it('finds every occurrence', () => {
    const fields = parseMergeFields('{{primeiro_nome|a}} ... {{primeiro_nome|b}}');

    expect(fields).toHaveLength(2);
    expect(fields[1].index).toBeGreaterThan(fields[0].index);
  });

  it('finds nothing in a plain message', () => {
    expect(parseMergeFields('Bom dia a todos')).toEqual([]);
    expect(hasMergeFields('Bom dia a todos')).toBe(false);
  });
});

describe('validateMergeFields (§7.4)', () => {
  it('accepts a field with a fallback', () => {
    expect(validateMergeFields('Olá {{primeiro_nome|amigo}}!').valid).toBe(true);
  });

  it('accepts a body with no merge field at all', () => {
    expect(validateMergeFields('Aviso geral para todos.').valid).toBe(true);
  });

  it('REJECTS a field without a fallback — error, not warning', () => {
    const result = validateMergeFields('Olá {{primeiro_nome}}!');

    expect(result.valid).toBe(false);
    expect(result.issues[0].reason).toBe('MISSING_FALLBACK');
  });

  it('explains WHY the fallback is required, in the message', () => {
    const result = validateMergeFields('Olá {{primeiro_nome}}!');

    // The reason is chip protection, and the author should read it once.
    expect(result.issues[0].message).toMatch(/Olá , tudo bem\?/);
    expect(result.issues[0].message).toMatch(/bloqueio/);
  });

  it('REJECTS an empty fallback — same problem as none', () => {
    const result = validateMergeFields('Olá {{primeiro_nome|}}!');

    expect(result.valid).toBe(false);
    expect(result.issues[0].reason).toBe('EMPTY_FALLBACK');
  });

  it('REJECTS an unknown field, so it can never reach the send path raw', () => {
    const result = validateMergeFields('Olá {{cidade|sua cidade}}!');

    expect(result.valid).toBe(false);
    expect(result.issues[0].reason).toBe('UNKNOWN_FIELD');
    // §2 keeps `city` out of v1 explicitly.
    expect(result.issues[0].message).toMatch(/primeiro_nome/);
  });

  it('rejects an unknown field even when it looks plausible', () => {
    for (const field of ['nome', 'first_name', 'primeiroNome', 'sobrenome']) {
      expect(validateMergeFields(`{{${field}|x}}`).valid).toBe(false);
    }
  });

  it('rejects a fallback long enough to be a paragraph', () => {
    const result = validateMergeFields(`{{primeiro_nome|${'a'.repeat(41)}}}`);

    expect(result.issues[0].reason).toBe('FALLBACK_TOO_LONG');
  });

  it('rejects a nested merge field inside a fallback', () => {
    const result = validateMergeFields('{{primeiro_nome|{{primeiro_nome|x}}}}');

    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.reason === 'FALLBACK_HAS_MERGE_FIELD')).toBe(true);
  });

  it('reports EVERY problem at once, not one per save', () => {
    const result = validateMergeFields('{{primeiro_nome}} e {{cidade|x}} e {{primeiro_nome|}}');

    expect(result.issues).toHaveLength(3);
    expect(result.issues.map((issue) => issue.reason)).toEqual([
      'MISSING_FALLBACK',
      'UNKNOWN_FIELD',
      'EMPTY_FALLBACK',
    ]);
  });

  it('is case insensitive about the field name', () => {
    expect(validateMergeFields('{{PRIMEIRO_NOME|amigo}}').valid).toBe(true);
  });
});

describe('renderMergeFields', () => {
  it('uses the first name when there is one', () => {
    const result = renderMergeFields('Olá {{primeiro_nome|amigo}}, tudo bem?', {
      firstName: 'Maria',
    });

    expect(result.body).toBe('Olá Maria, tudo bem?');
    expect(result.usedFallback).toBe(false);
  });

  it('uses the fallback when there is none — the case §7.4 exists for', () => {
    const result = renderMergeFields('Olá {{primeiro_nome|amigo}}, tudo bem?', {
      firstName: null,
    });

    expect(result.body).toBe('Olá amigo, tudo bem?');
    expect(result.usedFallback).toBe(true);
  });

  it('treats a blank first name as missing', () => {
    expect(renderMergeFields('{{primeiro_nome|amigo}}', { firstName: '   ' }).body).toBe('amigo');
  });

  it('renders every occurrence', () => {
    const result = renderMergeFields('{{primeiro_nome|amigo}} ... {{primeiro_nome|amigo}}', {
      firstName: 'Ana',
    });

    expect(result.body).toBe('Ana ... Ana');
  });

  it('NEVER leaves braces in the output, even for an invalid body', () => {
    // Validation prevents this at creation; rendering must not emit placeholders if a bug slips one in.
    const missing = renderMergeFields('Olá {{primeiro_nome}}!', { firstName: null });
    const unknown = renderMergeFields('Olá {{cidade|sua cidade}}!', { firstName: 'Ana' });

    expect(missing.body).not.toMatch(/[{}]/);
    expect(unknown.body).toBe('Olá sua cidade!');
    expect(unknown.usedFallback).toBe(true);
  });

  it('leaves a message with no merge field untouched', () => {
    const result = renderMergeFields('Aviso para todos.', { firstName: 'Ana' });

    expect(result.body).toBe('Aviso para todos.');
    expect(result.usedFallback).toBe(false);
  });

  it('does not treat single braces as a merge field', () => {
    const body = 'Use { chaves } normalmente, e {{primeiro_nome|amigo}}.';

    expect(renderMergeFields(body, { firstName: 'Ana' }).body).toBe(
      'Use { chaves } normalmente, e Ana.',
    );
  });
});
