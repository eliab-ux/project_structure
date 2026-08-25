import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  DISPATCH_REPOSITORY,
  DispatchRepositoryPort,
} from '../../../../distribution/application/ports/output/distribution-repositories.port';
import {
  MESSAGE_REPOSITORY,
  MessageRepositoryPort,
} from '../../../../inbox/application/ports/output/inbox-repositories.port';
import { RecordDeliveryAckCommand } from './record-delivery-ack.command';

/**
 * Records a provider delivery ack against the dispatch it belongs to.
 *
 * This is small and it is load-bearing. `delivery_rate` is the main signal the adaptive throttle reads
 * (§2.1), and the channel-signals port already warns about the failure mode: the moment `sent_count`
 * becomes non-zero, `delivered_count` MUST be being written too, or every channel reports a 0% delivery
 * rate, the policy reads that as blocking, and every quota falls to the floor at once. This use case is
 * what stops that from happening — it is the other half of FASE 7, not an accessory.
 *
 * The lookup is by `evolution_message_id`, which the send persisted. An ack for a message this system
 * did not send simply finds nothing and is ignored: the webhook is a public-ish surface and must not
 * be able to make the system throw.
 *
 * **Two places are searched, and the second one was a bug for a while.** A campaign send lives in
 * `dispatches`; an operator's reply from the inbox lives in `messages` (§10.3). Only `dispatches` was
 * consulted, so every reply's ack was thrown away — while `reply_sends` still counted towards the
 * denominator of `delivery_rate`. The arithmetic was merciless: each reply an operator sent pushed the
 * chip's delivery rate permanently down, and the panel eventually read that as a number being blocked.
 * A send that cannot ever be marked delivered must not be counted as undelivered either.
 */
@Injectable()
export class RecordDeliveryAckUseCase implements UseCase<RecordDeliveryAckCommand, boolean> {
  private readonly logger = new Logger(RecordDeliveryAckUseCase.name);

  constructor(
    @Inject(DISPATCH_REPOSITORY) private readonly dispatches: DispatchRepositoryPort,
    @Inject(MESSAGE_REPOSITORY) private readonly messages: MessageRepositoryPort,
  ) {}

  async execute(command: RecordDeliveryAckCommand): Promise<boolean> {
    const dispatch = await this.dispatches.findByProviderMessageId(command.providerMessageId);
    if (dispatch) {
      dispatch.recordDeliveryStatus(command.status);
      await this.dispatches.save(dispatch);
      return true;
    }

    // An inbox reply, then. Same provider id, different table.
    const message = await this.messages.findByProviderMessageId(command.providerMessageId);
    if (message) {
      message.recordDeliveryStatus(command.status);
      await this.messages.save(message);
      return true;
    }

    // Not an error: acks arrive for messages sent by other systems on a shared instance, and for
    // messages already purged. Ignoring them beats logging noise at warn level.
    this.logger.debug('Ack sem envio correspondente', {
      status: command.status,
    });
    return false;
  }
}
