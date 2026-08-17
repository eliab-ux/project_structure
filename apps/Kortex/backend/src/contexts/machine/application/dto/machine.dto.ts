import { Machine } from '../../domain/entities/machine.entity';

/**
 * Máquina **com preço** — servido apenas a `admin` e `owner`.
 *
 * O Modelista não recebe este DTO em lugar nenhum: ele nunca vê valor em dinheiro (spec §5). A
 * agenda da Fase 4 vai precisar de uma lista de máquinas para ele, e essa lista será um DTO
 * separado, sem `hourPriceCents` — não este com o campo escondido no frontend.
 */
export class MachineDto {
  id!: string;
  name!: string;
  model!: string | null;
  hourPriceCents!: number;
  isActive!: boolean;

  static fromDomain(machine: Machine): MachineDto {
    const dto = new MachineDto();
    dto.id = machine.id.value;
    dto.name = machine.name;
    dto.model = machine.model;
    dto.hourPriceCents = machine.hourPrice.cents;
    dto.isActive = machine.isActive;
    return dto;
  }
}
