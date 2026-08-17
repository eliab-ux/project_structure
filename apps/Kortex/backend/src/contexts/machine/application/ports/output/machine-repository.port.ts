import { Machine } from '../../../domain/entities/machine.entity';
import { AccountId } from '../../../../account/domain/value-objects/account-id.vo';
import { MachineId } from '../../../domain/value-objects/machine-id.vo';

export const MACHINE_REPOSITORY = Symbol('MACHINE_REPOSITORY');

/** Toda operação é escopada por conta — ver a nota em `business-hour-repository.port.ts`. */
export interface MachineRepositoryPort {
  listByAccount(accountId: AccountId): Promise<Machine[]>;
  findById(accountId: AccountId, id: MachineId): Promise<Machine | null>;
  save(machine: Machine): Promise<Machine>;
}
