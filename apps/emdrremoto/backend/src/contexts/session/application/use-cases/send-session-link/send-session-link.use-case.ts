import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UseCase } from '@gitspread/shared-kernel';
import {
  PACIENTE_REPOSITORY,
  PacienteRepositoryPort,
} from '../../../../paciente/application/ports/output/paciente-repository.port';
import { PacienteId } from '../../../../paciente/domain/value-objects/paciente-id.vo';
import { PacienteNotFoundException } from '../../../../paciente/domain/exceptions/paciente.exceptions';
import {
  NOTIFICATION_SERVICE,
  NotificationServicePort,
} from '../../../../notification/application/ports/notification-service.port';
import {
  SendWhatsappUseCase,
  SendWhatsappCommand,
} from '../../../../whatsapp/application/use-cases/send-whatsapp/send-whatsapp.use-case';
import { CreateSessionUseCase, CreateSessionCommand } from '../create-session/create-session.use-case';

export type SendChannel = 'whatsapp' | 'email';

export class SendSessionLinkCommand {
  constructor(
    public readonly psicologoId: string,
    public readonly pacienteId: string,
    public readonly channel: SendChannel,
  ) {}
}

export interface SendSessionLinkResult {
  link: string;
  sessionCode: string;
  channel: SendChannel;
}

/**
 * Cria uma sessão para o paciente e envia o link de acesso pelo canal escolhido
 * (WhatsApp via Evolution ou e-mail). Autorização de propriedade garantida.
 */
@Injectable()
export class SendSessionLinkUseCase
  implements UseCase<SendSessionLinkCommand, SendSessionLinkResult>
{
  constructor(
    @Inject(PACIENTE_REPOSITORY) private readonly pacientes: PacienteRepositoryPort,
    @Inject(NOTIFICATION_SERVICE) private readonly notifier: NotificationServicePort,
    private readonly createSession: CreateSessionUseCase,
    private readonly sendWhatsapp: SendWhatsappUseCase,
    private readonly config: ConfigService,
  ) {}

  async execute(command: SendSessionLinkCommand): Promise<SendSessionLinkResult> {
    const paciente = await this.pacientes.findById(PacienteId.from(command.pacienteId));
    if (!paciente || paciente.psicologoId !== command.psicologoId) {
      throw new PacienteNotFoundException(command.pacienteId);
    }

    const session = await this.createSession.execute(
      new CreateSessionCommand(command.psicologoId, command.pacienteId),
    );
    const link = `${this.frontendUrl()}/sessao/${paciente.hash}?code=${session.sessionCode}`;

    if (command.channel === 'whatsapp') {
      const text = `Olá, ${paciente.nome}! Sua sessão de EMDR está pronta. Acesse pelo link: ${link}`;
      await this.sendWhatsapp.execute(
        new SendWhatsappCommand(command.psicologoId, paciente.telefone, text),
      );
    } else {
      await this.notifier.sendSessionInvite({
        email: paciente.email,
        phone: paciente.telefone,
        nome: paciente.nome,
        sessionLink: link,
      });
    }

    return { link, sessionCode: session.sessionCode, channel: command.channel };
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
