export class DiagnoseWebhookCommand {
  constructor(
    public readonly accountId: string,
    public readonly channelId: string,
    /**
     * True → reasserts the configuration before reading it back.
     *
     * Separate from the read because the two answer different questions: without it the screen says
     * what is wrong, with it the screen fixes what is wrong. Merging them would mean you could never
     * observe the broken state, only the repaired one.
     */
    public readonly reconfigure: boolean,
  ) {}
}
