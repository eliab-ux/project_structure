export class GetMeQuery {
  constructor(
    /** Both come from the JWT — never from the request body. */
    public readonly userId: string,
    public readonly accountId: string,
  ) {}
}
