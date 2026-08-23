import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { PromissoryNoteRepositoryPort } from '../../../../contexts/route/application/ports/output/promissory-note-repository.port';
import { PromissoryNote } from '../../../../contexts/route/domain/entities/promissory-note.entity';
import { PromissoryNoteOrmEntity } from '../entities/promissory-note-orm.entity';

@Injectable()
export class MikroOrmPromissoryNoteRepository implements PromissoryNoteRepositoryPort {
  constructor(private readonly em: EntityManager) {}

  private toDomain(orm: PromissoryNoteOrmEntity): PromissoryNote {
    return PromissoryNote.reconstitute({
      id: orm.id,
      accountId: orm.accountId,
      orderId: orm.orderId,
      amount: orm.amount,
      amountInWords: orm.amountInWords,
      debtorName: orm.debtorName,
      debtorDocument: orm.debtorDocument,
      debtorAddress: orm.debtorAddress,
      dueDate: orm.dueDate,
      createdAt: orm.createdAt,
    });
  }

  async findByOrder(orderId: string): Promise<PromissoryNote | null> {
    const orm = await this.em.findOne(PromissoryNoteOrmEntity, { orderId });
    return orm ? this.toDomain(orm) : null;
  }

  async save(note: PromissoryNote): Promise<PromissoryNote> {
    const orm = this.em.create(PromissoryNoteOrmEntity, {
      id: note.id,
      accountId: note.accountId,
      orderId: note.orderId,
      amount: note.amount.toFixed(2),
      amountInWords: note.amountInWords,
      debtorName: note.debtorName,
      debtorDocument: note.debtorDocument,
      debtorAddress: note.debtorAddress,
      dueDate: note.dueDate,
      createdAt: note.createdAt,
      updatedAt: new Date(),
      deletedAt: null,
    });
    this.em.persist(orm);
    await this.em.flush();
    return this.toDomain(orm);
  }
}
