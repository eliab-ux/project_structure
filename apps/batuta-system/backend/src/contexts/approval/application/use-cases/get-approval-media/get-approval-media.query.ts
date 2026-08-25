export class GetApprovalMediaQuery {
  constructor(
    /** The magic-link token. It is the ONLY authorisation this route has. */
    public readonly token: string,
    public readonly mediaId: string,
  ) {}
}
