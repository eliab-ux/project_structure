import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomInt } from 'crypto';
import { UseCase } from '@gitspread/shared-kernel';
import {
  PSICOLOGO_REPOSITORY,
  PsicologoRepositoryPort,
} from '../../../../psicologo/application/ports/output/psicologo-repository.port';
import { Email } from '../../../../psicologo/domain/value-objects/email.vo';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import {
  NOTIFICATION_SERVICE,
  NotificationServicePort,
} from '../../../../notification/application/ports/notification-service.port';

export class RequestPasswordResetCommand {
  constructor(public readonly email: string) {}
}

@Injectable()
export class RequestPasswordResetUseCase implements UseCase<RequestPasswordResetCommand, void> {
  private readonly logger = new Logger(RequestPasswordResetUseCase.name);

  constructor(
    @Inject(PSICOLOGO_REPOSITORY) private readonly psicologos: PsicologoRepositoryPort,
    @Inject(NOTIFICATION_SERVICE) private readonly notifier: NotificationServicePort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: RequestPasswordResetCommand): Promise<void> {
    const psicologo = await this.psicologos.findByEmail(Email.create(command.email));
    // Fail Securely: nunca revela se o e-mail existe — sempre retorna sucesso ao cliente.
    if (!psicologo) {
      return;
    }

    const code = String(randomInt(100000, 1000000)); // 6 dígitos
    psicologo.setRecoveryCode(code);
    await this.uow.execute(() => this.psicologos.save(psicologo));

    this.notifier
      .sendPasswordRecovery(psicologo.email.value, psicologo.nome, code)
      .catch((error) => this.logger.error('Falha ao enviar código de recuperação', { error }));
  }
}
