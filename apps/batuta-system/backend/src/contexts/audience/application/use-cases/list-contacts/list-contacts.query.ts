export class ListContactsQuery {
  constructor(
    public readonly accountId: string,
    public readonly page: number,
    public readonly limit: number,
    public readonly tags?: string[],
    public readonly channelId?: string,
    public readonly active?: boolean,
    public readonly optedOut?: boolean,
    public readonly search?: string,
  ) {}
}
