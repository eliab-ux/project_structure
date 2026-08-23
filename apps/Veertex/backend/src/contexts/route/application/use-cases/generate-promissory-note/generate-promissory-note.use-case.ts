import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import {
  ORDER_REPOSITORY,
  OrderRepositoryPort,
} from '../../../../order/application/ports/output/order-repository.port';
import { OrderId } from '../../../../order/domain/value-objects/order-id.vo';
import { OrderNotFoundException } from '../../../../order/domain/exceptions/order-exceptions';
import {
  PROMISSORY_NOTE_REPOSITORY,
  PromissoryNoteRepositoryPort,
} from '../../ports/output/promissory-note-repository.port';
import {
  PROMISSORY_DEBTOR_LOOKUP,
  PromissoryDebtorLookupPort,
} from '../../ports/output/promissory-debtor-lookup.port';
import { PromissoryNote } from '../../../domain/entities/promissory-note.entity';
import { PromissoryAlreadyExistsException } from '../../../domain/exceptions/route-exceptions';

export class GeneratePromissoryNoteCommand {
  constructor(
    public readonly accountId: string,
    public readonly input: {
      orderId: string;
      /** Vencimento ≈ próxima passagem pela rota (informado; ~60 dias é o típico). */
      dueDate: Date;
      /** Endereço da devedora para o impresso — opcional (a retaguarda pode completar). */
      debtorAddress?: string | null;
    },
  ) {}
}

export interface PromissoryNoteResult {
  id: string;
  amount: number;
  amountInWords: string;
  debtorName: string;
  debtorDocument: string | null;
  dueDate: Date;
}

/**
 * Gera a promissória do pedido consignado (§3.1 do 04): **1 por pedido**, sobre o TOTAL, com
 * snapshot da devedora (nome/CPF do contato) e o valor POR EXTENSO — o dado que a térmica imprime.
 * Reimpressão/2ª via = reler esta linha, sempre possível (caso real: acabou a bobina).
 */
@Injectable()
export class GeneratePromissoryNoteUseCase implements UseCase<
  GeneratePromissoryNoteCommand,
  PromissoryNoteResult
> {
  constructor(
    @Inject(PROMISSORY_NOTE_REPOSITORY) private readonly notes: PromissoryNoteRepositoryPort,
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepositoryPort,
    @Inject(PROMISSORY_DEBTOR_LOOKUP) private readonly debtors: PromissoryDebtorLookupPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: GeneratePromissoryNoteCommand): Promise<PromissoryNoteResult> {
    return this.uow.execute(async () => {
      const order = await this.orders.findById(OrderId.from(command.input.orderId));
      if (!order) {
        throw new OrderNotFoundException(command.input.orderId);
      }

      if (await this.notes.findByOrder(order.id.value)) {
        throw new PromissoryAlreadyExistsException();
      }

      const debtor = await this.debtors.findByContact(order.contactId);

      const note = PromissoryNote.create({
        accountId: command.accountId,
        orderId: order.id.value,
        amount: order.total,
        debtorName: debtor?.name ?? 'Devedora não identificada',
        debtorDocument: debtor?.document ?? null,
        debtorAddress: command.input.debtorAddress ?? null,
        dueDate: command.input.dueDate,
      });
      const saved = await this.notes.save(note);
      return {
        id: saved.id,
        amount: saved.amount,
        amountInWords: saved.amountInWords,
        debtorName: saved.debtorName,
        debtorDocument: saved.debtorDocument,
        dueDate: saved.dueDate,
      };
    });
  }
}
