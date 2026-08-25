import { randomUUID } from 'node:crypto';

const MAX_TITLE = 120;
const MAX_BODY = 2000;

/**
 * A prepared answer the operator inserts and adjusts (§10.3 item 3).
 *
 * The spec calls this "Requisito, não conforto: é o que viabiliza volume", and the shape follows from
 * that: it is a template an operator edits before sending, not an automatic reply. Nothing in the
 * system sends one of these on its own — §2 forbids automatic replies to inbound, opt-out excepted.
 *
 * Merge fields are deliberately NOT resolved here. A quick reply is inserted into a text box the
 * operator then edits, so rendering `{{primeiro_nome}}` would either produce a placeholder someone has
 * to fix by hand, or require the contact's data in a screen that does not need it.
 */
export class QuickReply {
  private constructor(
    private readonly _id: string,
    private readonly _accountId: string,
    private _title: string,
    private _body: string,
    private _tags: string[],
    private readonly _createdBy: string,
    private _usageCount: number,
    private readonly _createdAt: Date,
  ) {}

  static create(params: {
    accountId: string;
    title: string;
    body: string;
    tags?: readonly string[];
    createdBy: string;
  }): QuickReply {
    return new QuickReply(
      randomUUID(),
      params.accountId,
      params.title.trim().slice(0, MAX_TITLE),
      params.body.trim().slice(0, MAX_BODY),
      QuickReply.normalizeTags(params.tags ?? []),
      params.createdBy,
      0,
      new Date(),
    );
  }

  static reconstitute(params: {
    id: string;
    accountId: string;
    title: string;
    body: string;
    tags: string[];
    createdBy: string;
    usageCount: number;
    createdAt: Date;
  }): QuickReply {
    return new QuickReply(
      params.id,
      params.accountId,
      params.title,
      params.body,
      params.tags,
      params.createdBy,
      params.usageCount,
      params.createdAt,
    );
  }

  get id(): string {
    return this._id;
  }

  get accountId(): string {
    return this._accountId;
  }

  get title(): string {
    return this._title;
  }

  get body(): string {
    return this._body;
  }

  get tags(): readonly string[] {
    return this._tags;
  }

  get createdBy(): string {
    return this._createdBy;
  }

  get usageCount(): number {
    return this._usageCount;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  change(params: { title?: string; body?: string; tags?: readonly string[] }): void {
    if (params.title !== undefined) {
      this._title = params.title.trim().slice(0, MAX_TITLE);
    }
    if (params.body !== undefined) {
      this._body = params.body.trim().slice(0, MAX_BODY);
    }
    if (params.tags !== undefined) {
      this._tags = QuickReply.normalizeTags(params.tags);
    }
  }

  /** Counted so the library can be ordered by what actually gets used. */
  registerUsage(): void {
    this._usageCount += 1;
  }

  private static normalizeTags(tags: readonly string[]): string[] {
    const seen = new Set<string>();
    for (const tag of tags) {
      const clean = tag.trim().toLowerCase();
      if (clean) {
        seen.add(clean);
      }
    }
    return [...seen].sort();
  }
}
