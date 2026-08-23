import { FieldReceipt } from '../../../domain/entities/field-receipt.entity';

export const FIELD_RECEIPT_REPOSITORY = Symbol('FIELD_RECEIPT_REPOSITORY');

export interface FieldReceiptRepositoryPort {
  findById(id: string): Promise<FieldReceipt | null>;
  listByTrip(tripId: string): Promise<FieldReceipt[]>;
  save(receipt: FieldReceipt): Promise<FieldReceipt>;
}
