/**
 * Minimal RFC 4180 CSV writer.
 *
 * Written rather than pulled in as a dependency because the requirement is small and the failure modes
 * are specific. Two of them are worth naming:
 *
 *  1. **Quoting.** A `rendered_body` legitimately contains commas, quotes and newlines — it is a WhatsApp
 *     message. Getting this wrong does not produce a warning, it produces a file that opens misaligned
 *     and silently attributes one person's text to another row.
 *  2. **Formula injection.** A cell starting with `=`, `+`, `-` or `@` is executed as a formula by Excel
 *     and Google Sheets. A contact named `=cmd|...` would turn an audit export into an attack on whoever
 *     opens it. Prefixing with a single quote neutralises it and is the standard mitigation.
 *
 * The BOM is deliberate: without it, Excel on Windows reads UTF-8 as Latin-1 and every accented Brazilian
 * name in the report comes out mangled.
 */
const BOM = '﻿';

/** Excel and Sheets treat these as the start of a formula. */
const FORMULA_STARTERS = ['=', '+', '-', '@', '\t', '\r'];

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  let text = value instanceof Date ? value.toISOString() : String(value);

  if (FORMULA_STARTERS.some((starter) => text.startsWith(starter))) {
    // Neutralised, not stripped: the original value stays readable, it just is not executed.
    text = `'${text}`;
  }

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/**
 * Turns rows into CSV. Column order comes from the FIRST row's keys, so the caller controls it by
 * building the object in the order it wants to read.
 */
export function toCsv(rows: readonly Record<string, unknown>[]): string {
  if (rows.length === 0) {
    return BOM;
  }

  const headers = Object.keys(rows[0]);
  const lines = [headers.map(escapeCell).join(',')];

  for (const row of rows) {
    lines.push(headers.map((header) => escapeCell(row[header])).join(','));
  }

  // CRLF: the line ending every spreadsheet on every platform reads without complaint.
  return BOM + lines.join('\r\n') + '\r\n';
}
