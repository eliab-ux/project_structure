export class DecideApprovalCommand {
  constructor(
    /** Plaintext magic-link token. Hashed immediately; never stored, never logged. */
    public readonly token: string,
    public readonly decision: 'APPROVE' | 'REJECT',
    public readonly comment: string | null,
    /** Recorded so the decision is defensible: who, when, from where (8 item 4). */
    public readonly ip: string | null,
    public readonly userAgent: string | null,
  ) {}
}
