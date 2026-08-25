import { Injectable, Logger } from '@nestjs/common';
import { parse as parseCsv } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import {
  ColumnMapping,
  ContactFileParseResult,
  ContactFileParserPort,
  ParsedContactRow,
} from '../../contexts/audience/application/ports/output/contact-import.ports';

/** Hard cap so a hostile or accidental 500k-row file cannot exhaust memory. */
const MAX_ROWS = 100_000;

/** Separators a Brazilian operator actually produces in a tags column. */
const TAG_SEPARATORS = /[;,|]/;

/**
 * Parses CSV and XLSX into rows (§6.1 items 1 and 2).
 *
 * Format is decided by extension and content, not trusted from the client's mime type — browsers send
 * `application/octet-stream` for .xlsx often enough that trusting it would break real uploads.
 *
 * CSV delimiter is auto-detected between `,` and `;` because Excel in pt-BR writes semicolons, and an
 * operator exporting from Excel has no idea that matters.
 */
@Injectable()
export class ContactFileParser implements ContactFileParserPort {
  private readonly logger = new Logger(ContactFileParser.name);

  async parse(input: {
    buffer: Buffer;
    fileName: string;
    mimeType: string;
    mapping: ColumnMapping;
    hasHeader: boolean;
  }): Promise<ContactFileParseResult> {
    const isXlsx =
      input.fileName.toLowerCase().endsWith('.xlsx') ||
      input.mimeType.includes('spreadsheetml') ||
      // XLSX is a zip: "PK" magic bytes.
      (input.buffer.length > 2 && input.buffer[0] === 0x50 && input.buffer[1] === 0x4b);

    const table = isXlsx
      ? await ContactFileParser.readXlsx(input.buffer)
      : ContactFileParser.readCsv(input.buffer);

    if (table.length === 0) {
      throw new Error('Arquivo sem linhas legíveis.');
    }

    const header = input.hasHeader ? table[0].map((cell) => cell.trim()) : [];
    const body = input.hasHeader ? table.slice(1) : table;

    if (body.length > MAX_ROWS) {
      throw new Error(`Arquivo com mais de ${MAX_ROWS} linhas. Divida a lista em partes.`);
    }

    const phoneIndex = ContactFileParser.resolveColumn(
      header,
      input.mapping.phone,
      input.hasHeader,
    );
    if (phoneIndex < 0) {
      // §6.1 item 2: the phone column is mandatory. Failing here beats importing a column of names
      // as phone numbers.
      throw new Error(
        `Coluna de telefone "${input.mapping.phone}" não encontrada no arquivo. ` +
          (header.length ? `Colunas disponíveis: ${header.join(', ')}.` : ''),
      );
    }
    const nameIndex = input.mapping.name
      ? ContactFileParser.resolveColumn(header, input.mapping.name, input.hasHeader)
      : -1;
    const tagsIndex = input.mapping.tags
      ? ContactFileParser.resolveColumn(header, input.mapping.tags, input.hasHeader)
      : -1;

    const rows: ParsedContactRow[] = body
      .map((cells, index) => ({
        // 1-based, header included, so it matches the line the operator sees in Excel.
        lineNumber: index + (input.hasHeader ? 2 : 1),
        phone: ContactFileParser.cell(cells, phoneIndex),
        name: ContactFileParser.cell(cells, nameIndex),
        tags: ContactFileParser.splitTags(ContactFileParser.cell(cells, tagsIndex)),
        blank: cells.every((cell) => (cell ?? '').trim() === ''),
      }))
      // Excel escreve linhas totalmente vazias no fim do arquivo — `;;` — e `skipEmptyLines` não as
      // descarta, porque para o parser elas TÊM campos, só vazios. Contá-las como rejeição fazia um
      // arquivo correto de 4 contatos ser reportado como "4 importados, 5 inválidos", e o operador vai
      // procurar cinco erros que não existem. A filtragem é depois do `map` de propósito: o número da
      // linha das rejeições REAIS continua sendo o do Excel.
      .filter((row) => !row.blank)
      .map(({ blank: _blank, ...row }) => row);

    this.logger.log('Arquivo de contatos lido', {
      rows: rows.length,
      format: isXlsx ? 'xlsx' : 'csv',
    });

    return { rows, detectedColumns: header };
  }

  private static readCsv(buffer: Buffer): string[][] {
    // Strip a UTF-8 BOM (U+FEFF), written as an escape so no invisible character lives in
    // this file. Excel adds one, and it would end up glued to the first header name.
    const text = buffer.toString('utf8').replace(/^\uFEFF/, '');
    const firstLine = text.slice(0, text.indexOf('\n') === -1 ? text.length : text.indexOf('\n'));
    const delimiter =
      (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';

    return parseCsv(text, {
      delimiter,
      relaxColumnCount: true,
      relaxQuotes: true,
      skipEmptyLines: true,
      trim: true,
    }) as string[][];
  }

  private static async readXlsx(buffer: Buffer): Promise<string[][]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

    const sheet = workbook.worksheets[0];
    if (!sheet) {
      throw new Error('Planilha sem abas legíveis.');
    }

    const table: string[][] = [];
    sheet.eachRow({ includeEmpty: false }, (row) => {
      const cells: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell) => {
        cells.push(ContactFileParser.stringifyCell(cell.value));
      });
      if (cells.some((cell) => cell.trim() !== '')) {
        table.push(cells);
      }
    });
    return table;
  }

  /**
   * A phone in a spreadsheet arrives as a number, a string, or a formula result. Numbers are the
   * dangerous case: Excel turns `5511999998888` into 5511999998888 and may render it in scientific
   * notation, so it is stringified without exponent here.
   */
  private static stringifyCell(value: ExcelJS.CellValue): string {
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'number') {
      return Number.isInteger(value) ? value.toFixed(0) : String(value);
    }
    if (typeof value === 'string') {
      return value;
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === 'object') {
      const record = value as unknown as Record<string, unknown>;
      if (typeof record.text === 'string') {
        return record.text;
      }
      if (typeof record.result === 'string' || typeof record.result === 'number') {
        return String(record.result);
      }
      if (Array.isArray(record.richText)) {
        return (record.richText as { text?: string }[]).map((part) => part.text ?? '').join('');
      }
    }
    return String(value);
  }

  /** Header name (case-insensitive) or a 0-based index when the file has no header. */
  private static resolveColumn(header: string[], key: string, hasHeader: boolean): number {
    if (!hasHeader) {
      const index = Number.parseInt(key, 10);
      return Number.isInteger(index) && index >= 0 ? index : -1;
    }
    const wanted = key.trim().toLowerCase();
    return header.findIndex((column) => column.trim().toLowerCase() === wanted);
  }

  private static cell(cells: readonly string[], index: number): string | null {
    if (index < 0 || index >= cells.length) {
      return null;
    }
    const value = (cells[index] ?? '').trim();
    return value === '' ? null : value;
  }

  private static splitTags(raw: string | null): string[] {
    if (!raw) {
      return [];
    }
    return raw
      .split(TAG_SEPARATORS)
      .map((tag) => tag.trim())
      .filter((tag) => tag !== '');
  }
}
