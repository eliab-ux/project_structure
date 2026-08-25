import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  PSICOLOGO_REPOSITORY,
  PsicologoRepositoryPort,
} from '../../ports/output/psicologo-repository.port';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import { PsicologoId } from '../../../domain/value-objects/psicologo-id.vo';
import { PsicologoNotFoundException } from '../../../domain/exceptions/psicologo.exceptions';

export class VerifyEmailCommand {
  constructor(public readonly psicologoId: string) {}
}

@Injectable()
export class VerifyEmailUseCase implements UseCase<VerifyEmailCommand, void> {
  constructor(
    @Inject(PSICOLOGO_REPOSITORY) private readonly repository: PsicologoRepositoryPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: VerifyEmailCommand): Promise<void> {
    const psicologo = await this.repository.findById(PsicologoId.from(command.psicologoId));
    if (!psicologo) {
      throw new PsicologoNotFoundException(command.psicologoId);
    }
    psicologo.verifyEmail();
    await this.uow.execute(() => this.repository.save(psicologo));
  }
}
