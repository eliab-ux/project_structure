export class PreviewContentQuery {
  constructor(
    public readonly accountId: string,
    public readonly contentId: string,
    /** Optional audience filter, so the sample comes from the people who will actually receive it. */
    public readonly tags?: string[],
  ) {}
}
