export class RecordDeliveryAckCommand {
  constructor(
    public readonly accountId: string,
    /** `dispatches.evolution_message_id`, persisted at send time. */
    public readonly providerMessageId: string,
    /** Already normalised by the webhook adapter, e.g. DELIVERED / READ / FAILED. */
    public readonly status: string,
  ) {}
}
