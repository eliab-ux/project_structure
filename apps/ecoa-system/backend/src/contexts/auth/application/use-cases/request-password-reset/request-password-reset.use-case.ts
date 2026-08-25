import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { UseCase } from '@gitspread/shared-kernel';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import {
  USER_REPOSITORY,
  UserRepositoryPort,
} from '../../../../user/application/ports/output/user-repository.port';
import { Email } from '../../../../user/domain/value-objects/email.vo';
import { EMAIL_SENDER, EmailSenderPort } from '../../ports/output/email-sender.port';

@Injectable()
export class RequestPasswordResetUseCase implements UseCase<{ email: string }, void> {
  private readonly logger = new Logger(RequestPasswordResetUseCase.name);
  private readonly tokenTtlMinutes = 60;

  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepositoryPort,
    @Inject(EMAIL_SENDER) private readonly emailSender: EmailSenderPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
    private readonly configService: ConfigService,
  ) {}

  async execute(command: { email: string }): Promise<void> {
    const user = await this.userRepository.findByEmail(Email.create(command.email));

    // Always return success to the caller — never reveal whether the email is registered.
    if (!user) {
      return;
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + this.tokenTtlMinutes * 60 * 1000);
    user.setPasswordResetToken(token, expiresAt);

    await this.uow.execute(async () => {
      await this.userRepository.save(user);
    });

    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3003');
    const resetLink = `${frontendUrl}/auth/reset-password?token=${token}`;

    try {
      await this.emailSender.sendPasswordReset(user.email.value, user.name, resetLink);
    } catch (error) {
      this.logger.error('Falha ao enviar e-mail de reset', { userId: user.id.value, error });
    }
  }
}
