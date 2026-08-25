import { MessageKind } from '../../../domain/value-objects/message-kind.vo';

export class IngestInboundMessageCommand {
  constructor(
    /** From the namespaced instance name, never from the payload body. */
    public readonly accountId: string,
    public readonly channelId: string,
    public readonly fromPhone: string,
    public readonly kind: MessageKind,
    public readonly body: string | null,
    /** Provider id — the idempotency key against webhook retries. */
    public readonly providerMessageId: string | null,
    /** When the CONTACT sent it, not when we received it: the queue orders by age. */
    public readonly occurredAt: Date,
    public readonly mediaBase64: string | null = null,
    public readonly mediaUrl: string | null = null,
    public readonly mediaMimeType: string | null = null,
    public readonly mediaFileName: string | null = null,
  ) {}
}
