export class GetCurrentAccountQuery {
  /** Always the accountId from the JWT. There is no endpoint that takes it from the client. */
  constructor(public readonly accountId: string) {}
}
