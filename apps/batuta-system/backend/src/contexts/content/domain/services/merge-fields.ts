/**
 * The ONLY merge field of v1 (§7.4: "Escopo v1: `{{primeiro_nome}}` apenas. Não implemente outros
 * campos."). `city` and the rest are explicitly out of scope (§2).
 */
export const MERGE_FIELD_FIRST_NAME = 'primeiro_nome';

export const KNOWN_MERGE_FIELDS: readonly string[] = [MERGE_FIELD_FIRST_NAME];

/**
 * Matches `{{ nome | fallback }}` with optional inner spaces. The fallback part is captured
 * SEPARATELY and optionally, so a field written without one is recognised — and then rejected with a
 * precise message, instead of failing to parse.
 */
const MERGE_FIELD_PATTERN = /\{\{\s*([a-z_][a-z0-9_]*)\s*(?:\|([^}]*))?\}\}/gi;

/** Bounded so a fallback cannot smuggle a paragraph into every message. */
const MAX_FALLBACK_LENGTH = 40;

export interface ParsedMergeField {
  /** Full matched text, e.g. `{{primeiro_nome|amigo}}`. */
  raw: string;
  name: string;
  /** Null when the author omitted the `|fallback` part — which is a validation error. */
  fallback: string | null;
  /** Index in the body, so an error message can point at the right occurrence. */
  index: number;
}

export interface MergeFieldIssue {
  raw: string;
  reason:
    | 'MISSING_FALLBACK'
    | 'UNKNOWN_FIELD'
    | 'EMPTY_FALLBACK'
    | 'FALLBACK_TOO_LONG'
    | 'FALLBACK_HAS_MERGE_FIELD';
  message: string;
}

export interface MergeFieldValidation {
  valid: boolean;
  fields: ParsedMergeField[];
  issues: MergeFieldIssue[];
}

/** Every merge field in a body, in order of appearance. */
export function parseMergeFields(body: string): ParsedMergeField[] {
  const fields: ParsedMergeField[] = [];
  const pattern = new RegExp(MERGE_FIELD_PATTERN.source, MERGE_FIELD_PATTERN.flags);

  let match = pattern.exec(body ?? '');
  while (match !== null) {
    const [raw, name, fallback] = match;
    fields.push({
      raw,
      name: name.toLowerCase(),
      // An absent group is `undefined`; an empty one (`{{x|}}`) is `''` and must not be confused
      // with "no fallback given" — they are different mistakes with different messages.
      fallback: fallback === undefined ? null : fallback.trim(),
      index: match.index,
    });
    match = pattern.exec(body ?? '');
  }

  return fields;
}

/**
 * Validates every merge field in a body (§7.4).
 *
 * Two rules, both ERRORS and not warnings:
 *  - a field with no fallback is invalid. The reason is in the spec and worth repeating: an empty
 *    value produces "Olá , tudo bem?", which reads as a broken robot and gets the chip blocked.
 *    The fallback is chip protection, not convenience;
 *  - an unknown field is invalid, so it can never reach the send path raw.
 */
export function validateMergeFields(body: string): MergeFieldValidation {
  const fields = parseMergeFields(body);
  const issues: MergeFieldIssue[] = [];

  for (const field of fields) {
    if (!KNOWN_MERGE_FIELDS.includes(field.name)) {
      issues.push({
        raw: field.raw,
        reason: 'UNKNOWN_FIELD',
        message:
          `Campo desconhecido "${field.name}" em ${field.raw}. ` +
          `Nesta versão só existe {{${MERGE_FIELD_FIRST_NAME}|fallback}}.`,
      });
      continue;
    }

    if (field.fallback === null) {
      issues.push({
        raw: field.raw,
        reason: 'MISSING_FALLBACK',
        message:
          `${field.raw} está sem fallback. Use {{${field.name}|amigo}} — sem ele, um contato sem ` +
          'nome recebe "Olá , tudo bem?", que parece robô defeituoso e aumenta bloqueio.',
      });
      continue;
    }

    if (field.fallback === '') {
      issues.push({
        raw: field.raw,
        reason: 'EMPTY_FALLBACK',
        message: `${field.raw} tem fallback vazio, o que é o mesmo problema que não ter fallback.`,
      });
      continue;
    }

    if (field.fallback.length > MAX_FALLBACK_LENGTH) {
      issues.push({
        raw: field.raw,
        reason: 'FALLBACK_TOO_LONG',
        message: `Fallback de ${field.raw} passa de ${MAX_FALLBACK_LENGTH} caracteres.`,
      });
      continue;
    }

    if (/\{\{|\}\}/.test(field.fallback)) {
      // A nested field would either render literally or recurse; neither is acceptable output.
      issues.push({
        raw: field.raw,
        reason: 'FALLBACK_HAS_MERGE_FIELD',
        message: `O fallback de ${field.raw} não pode conter outro merge field.`,
      });
    }
  }

  return { valid: issues.length === 0, fields, issues };
}

export interface MergeFieldContext {
  /** Null when the contact has no usable first name — exactly what the fallback exists for. */
  firstName: string | null;
}

export interface RenderResult {
  body: string;
  /** True when at least one field fell back — what §9.3 counts across the audience. */
  usedFallback: boolean;
}

/**
 * Renders a body for one contact.
 *
 * Never throws and never leaves a placeholder behind: by the time a body is rendered it has already
 * been validated at creation, and an unvalidated body still renders to something sendable rather than
 * shipping `{{...}}` to a real person. A field with no fallback at all degrades to empty string — the
 * outcome the validator exists to prevent, kept here only so a bug upstream cannot emit braces.
 */
export function renderMergeFields(body: string, context: MergeFieldContext): RenderResult {
  let usedFallback = false;

  const rendered = (body ?? '').replace(
    new RegExp(MERGE_FIELD_PATTERN.source, MERGE_FIELD_PATTERN.flags),
    (_raw: string, name: string, fallback: string | undefined) => {
      const field = name.toLowerCase();
      const fallbackValue = (fallback ?? '').trim();

      if (field !== MERGE_FIELD_FIRST_NAME) {
        usedFallback = true;
        return fallbackValue;
      }

      const value = context.firstName?.trim();
      if (value) {
        return value;
      }

      usedFallback = true;
      return fallbackValue;
    },
  );

  return { body: rendered, usedFallback };
}

/** Whether a body personalises at all — used to explain a preview that looks identical for everyone. */
export function hasMergeFields(body: string): boolean {
  return parseMergeFields(body).length > 0;
}
