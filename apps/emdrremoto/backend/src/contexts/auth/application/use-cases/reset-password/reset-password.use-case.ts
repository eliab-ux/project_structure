import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  PSICOLOGO_REPOSITORY,
  PsicologoRepositoryPort,
} from '../../../../psicologo/application/ports/output/psicologo-repository.port';
import {
  PASSWORD_HASHER,
  PasswordHasherPort,
} from '../../../../../infrastructure/security/ports/password-hasher.port';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import { InvalidCredentialsException } from '../../../domain/exceptions/auth.exceptions';

export class ResetPasswordCommand {
  constructor(
    public readonly code: string,
    public readonly senha: string,
  ) {}
}

@Injectable()
export class ResetPasswordUseCase implements UseCase<ResetPasswordCommand, void> {
  constructor(
    @Inject(PSICOLOGO_REPOSITORY) private readonly psicologos: PsicologoRepositoryPort,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasherPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: ResetPasswordCommand): Promise<void> {
    const psicologo = await this.psicologos.findByRecoveryCode(command.code);
    if (!psicologo || !psicologo.matchesRecoveryCode(command.code)) {
      throw new InvalidCredentialsException();
    }
    const hash = await this.hasher.hash(command.senha);
    psicologo.changePassword(hash); // também limpa o recovery code
    await this.uow.execute(() => this.psicologos.save(psicologo));
  }
}
