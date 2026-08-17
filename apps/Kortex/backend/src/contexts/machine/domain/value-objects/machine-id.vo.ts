import { UuidId } from '../../../../shared/domain/value-objects/uuid-id.vo';

export class MachineId extends UuidId {
  static from(value: string): MachineId {
    return new MachineId(UuidId.parse(value, 'Identificador da máquina'));
  }

  static create(): MachineId {
    return new MachineId(UuidId.generate());
  }
}
