import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  MACHINE_REPOSITORY,
  MachineRepositoryPort,
} from '../../ports/output/machine-repository.port';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import { MachineDto } from '../../dto/machine.dto';
import { MachineNotFoundException } from '../../../domain/exceptions/machine-not-found.exception';
import { AccountId } from '../../../../account/domain/value-objects/account-id.vo';
import { MachineId } from '../../../domain/value-objects/machine-id.vo';
import { Money } from '../../../../../shared/domain/value-objects/money.vo';

export class UpdateMachineCommand {
  constructor(
    public readonly accountId: string,
    public readonly machineId: string,
    public readonly name: string,
    public readonly model: string | null,
    public readonly hourPriceCents: number,
    public readonly isActive: boolean,
  ) {}
}

@Injectable()
export class UpdateMachineUseCase implements UseCase<UpdateMachineCommand, MachineDto> {
  constructor(
    @Inject(MACHINE_REPOSITORY)
    private readonly machineRepository: MachineRepositoryPort,
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(command: UpdateMachineCommand): Promise<MachineDto> {
    const accountId = AccountId.from(command.accountId);

    const machine = await this.machineRepository.findById(
      accountId,
      MachineId.from(command.machineId),
    );
    if (!machine) {
      throw new MachineNotFoundException();
    }

    machine.rename(command.name);
    machine.changeModel(command.model);
    // Mudar o preço aqui não toca em nenhuma reserva existente: cada reserva grava o valor da
    // máquina no dia da venda (decisão 2.9). É por isso que não há confirmação nem histórico aqui.
    machine.changeHourPrice(Money.fromCents(command.hourPriceCents));

    if (command.isActive) {
      machine.activate();
    } else {
      machine.deactivate();
    }

    return this.unitOfWork.execute(async () => {
      const saved = await this.machineRepository.save(machine);
      return MachineDto.fromDomain(saved);
    });
  }
}
