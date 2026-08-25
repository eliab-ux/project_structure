import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UseCase } from '@gitspread/shared-kernel';
import {
  PSICOLOGO_REPOSITORY,
  PsicologoRepositoryPort,
} from '../../ports/output/psicologo-repository.port';
import {
  PASSWORD_HASHER,
  PasswordHasherPort,
} from '../../../../../infrastructure/security/ports/password-hasher.port';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import {
  NOTIFICATION_SERVICE,
  NotificationServicePort,
} from '../../../../notification/application/ports/notification-service.port';
import { Email } from '../../../domain/value-objects/email.vo';
import { Psicologo } from '../../../domain/entities/psicologo.entity';
import { PsicologoAlreadyExistsException } from '../../../domain/exceptions/psicologo.exceptions';
import { PsicologoDto } from '../../dto/psicologo.dto';
import { RegisterPsicologoCommand } from './register-psicologo.command';

@Injectable()
export class RegisterPsicologoUseCase implements UseCase<RegisterPsicologoCommand, PsicologoDto> {
  private readonly logger = new Logger(RegisterPsicologoUseCase.name);

  constructor(
    @Inject(PSICOLOGO_REPOSITORY) private readonly repository: PsicologoRepositoryPort,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasherPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
    @Inject(NOTIFICATION_SERVICE) private readonly notifier: NotificationServicePort,
    private readonly config: ConfigService,
  ) {}

  async execute(command: RegisterPsicologoCommand): Promise<PsicologoDto> {
    const email = Email.create(command.email);

    const existing = await this.repository.findByEmail(email);
    if (existing) {
      throw new PsicologoAlreadyExistsException(email.value);
    }

    const passwordHash = await this.hasher.hash(command.senha);
    const psicologo = Psicologo.register(email, command.nome, command.telefone, passwordHash);

    const saved = await this.uow.execute(() => this.repository.save(psicologo));

    // Fire-and-forget verification e-mail — a falha de envio não invalida o cadastro.
    const verificationUrl = `${this.frontendUrl()}/auth/validar-email/${saved.id.value}`;
    this.notifier
      .sendEmailVerification(saved.email.value, saved.nome, verificationUrl)
      .catch((error) => this.logger.error('Falha ao enviar e-mail de verificação', { error }));

    return PsicologoDto.fromDomain(saved);
  }

  private frontendUrl(): string {
    const publicUrl = this.config.get<string>('APP_PUBLIC_URL');
    if (publicUrl && publicUrl.trim()) {
      return publicUrl.trim().replace(/\/+$/, '');
    }
    const origins = (this.config.get<string>('CORS_ORIGIN') ?? '').split(',');
    return origins[0]?.trim() || 'http://localhost:3006';
  }
}
