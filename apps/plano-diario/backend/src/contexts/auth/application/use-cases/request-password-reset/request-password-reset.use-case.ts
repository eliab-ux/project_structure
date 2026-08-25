import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { UseCase } from '@gitspread/shared-kernel';
import {
  PASSWORD_HASHER,
  PasswordHasherPort,
} from '../../../../../infrastructure/security/ports/password-hasher.port';
import { Email } from '../../../../user/domain/value-objects/email.vo';
import {
  USER_REPOSITORY,
  UserRepositoryPort,
} from '../../../../user/application/ports/output/user-repository.port';
import {
  PasswordResetCode,
  RESET_CODE_TTL_MINUTES,
} from '../../../domain/entities/password-reset-code.entity';
import {
  PASSWORD_RESET_CODE_REPOSITORY,
  PasswordResetCodeRepositoryPort,
} from '../../ports/output/password-reset-code-repository.port';
import {
  SUPPORT_MESSENGER,
  SupportMessengerPort,
} from '../../ports/output/support-messenger.port';

export interface RequestPasswordResetCommand {
  email: string;
}

/** Quantos códigos um usuário pode pedir por hora. Protege o WhatsApp dele de virar canal de spam. */
const MAX_REQUESTS_PER_HOUR = 3;

/**
 * Manda o código de recuperação pelo WhatsApp de suporte.
 *
 * **Este use case nunca revela se a conta existe.** Todos os caminhos de recusa (e-mail
 * desconhecido, conta desativada, sem WhatsApp cadastrado, limite por hora) terminam do mesmo
 * jeito: sem exceção, sem retorno diferente. Quem chama responde sempre a mesma frase.
 * A distinção fica no log, que é interno.
 */
@Injectable()
export class RequestPasswordResetUseCase implements UseCase<RequestPasswordResetCommand, void> {
  private readonly logger = new Logger(RequestPasswordResetUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(PASSWORD_RESET_CODE_REPOSITORY)
    private readonly codes: PasswordResetCodeRepositoryPort,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasherPort,
    @Inject(SUPPORT_MESSENGER) private readonly messenger: SupportMessengerPort,
  ) {}

  async execute(command: RequestPasswordResetCommand): Promise<void> {
    // PRIMEIRA coisa, antes de tocar no banco: se o canal está quebrado, o erro tem que ser o
    // mesmo para todo e-mail. Verificar depois faria e-mail real falhar e e-mail inexistente
    // responder 200 — exatamente a distinção que este use case existe para não dar.
    this.messenger.ensureAvailable();

    const user = await this.users.findByEmail(Email.create(command.email));

    if (!user || !user.canAuthenticate) {
      this.logger.log('Recuperação pedida para conta inexistente ou inativa; nada enviado');
      return;
    }
    if (!user.phone) {
      // Conta criada antes do WhatsApp ser obrigatório: não há para onde enviar.
      this.logger.warn('Conta sem WhatsApp cadastrado pediu recuperação', { userId: user.id.value });
      return;
    }

    const now = new Date();
    const recent = await this.codes.countSentSince(
      user.id.value,
      new Date(now.getTime() - 60 * 60_000),
    );
    if (recent >= MAX_REQUESTS_PER_HOUR) {
      this.logger.warn('Limite de solicitações por hora atingido', { userId: user.id.value });
      return;
    }

    // Só um código vivo por vez: dois códigos válidos dobrariam a chance de adivinhação.
    await this.codes.invalidateAllForUser(user.id.value, now);

    const code = RequestPasswordResetUseCase.generateCode();
    // Persistido ANTES do envio: se a ordem fosse inversa e a gravação falhasse, o usuário teria
    // em mãos um código que o sistema não reconhece.
    const issued = await this.codes.save(
      PasswordResetCode.issue({
        userId: user.id.value,
        // Guardado com o mesmo hash da senha — o valor em claro só existe nesta função e na
        // mensagem que o usuário recebe.
        codeHash: await this.hasher.hash(code),
        now,
      }),
    );

    await this.messenger.sendPasswordResetCode({
      phone: user.phone.value,
      name: user.name.split(' ')[0],
      code,
      expiresInMinutes: RESET_CODE_TTL_MINUTES,
    });

    // `sentAt` só é gravado aqui, depois do envio dar certo. Se o envio tiver falhado, a exceção
    // sobe e este código fica com `sentAt` nulo: continua utilizável (pode ter chegado), mas não
    // consome a cota da próxima tentativa.
    issued.markSent();
    await this.codes.save(issued);

    // Sem o código e sem o número no log.
    this.logger.log('Código de recuperação enviado', { userId: user.id.value });
  }

  /**
   * 6 dígitos com `randomInt` do `node:crypto` — `Math.random()` é previsível e não serve para
   * gerar segredo. `padStart` mantém códigos como `000123` com o mesmo comprimento.
   */
  private static generateCode(): string {
    return String(randomInt(0, 1_000_000)).padStart(6, '0');
  }
}
