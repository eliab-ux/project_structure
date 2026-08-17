import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  USER_REPOSITORY,
  UserRepositoryPort,
} from '../../../../user/application/ports/output/user-repository.port';
import {
  PASSWORD_HASHER,
  PasswordHasherPort,
} from '../../../../user/application/ports/output/password-hasher.port';
import {
  PASSWORD_RESET_CODE_REPOSITORY,
  PasswordResetCodeRepositoryPort,
} from '../../ports/output/password-reset-code-repository.port';
import {
  PASSWORD_RESET_NOTIFIER,
  PasswordResetNotifierPort,
} from '../../ports/output/password-reset-notifier.port';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import { PasswordResetCode } from '../../../domain/entities/password-reset-code.entity';
import { Email } from '../../../../../shared/domain/value-objects/email.vo';

/** Envios por hora, por usuário. O WhatsApp de ninguém pode virar canal de spam. */
const MAX_SENDS_PER_HOUR = 3;

export class RequestPasswordResetCommand {
  constructor(public readonly email: string) {}
}

/**
 * Pede um código de recuperação. **Nunca lança por causa do e-mail** e sempre responde igual —
 * a resposta é 204 para e-mail existente, inexistente, de usuário inativo ou com a cota estourada.
 *
 * Isso é a regra do CLAUDE.md e não excesso de zelo: qualquer diferença observável entre os casos
 * transforma esta rota, que é pública por natureza, num verificador de quem trabalha na empresa.
 *
 * A ordem das verificações também é regra: o CANAL é checado antes de procurar o usuário. Se o
 * canal só falhasse no envio, o e-mail real produziria 500 e o inexistente 204 — e a diferença
 * seria a resposta.
 */
@Injectable()
export class RequestPasswordResetUseCase implements UseCase<RequestPasswordResetCommand, void> {
  private readonly logger = new Logger(RequestPasswordResetUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasherPort,
    @Inject(PASSWORD_RESET_CODE_REPOSITORY)
    private readonly codeRepository: PasswordResetCodeRepositoryPort,
    @Inject(PASSWORD_RESET_NOTIFIER)
    private readonly notifier: PasswordResetNotifierPort,
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(command: RequestPasswordResetCommand): Promise<void> {
    if (!this.notifier.isConfigured()) {
      this.logger.error(
        'Recuperação de senha indisponível: canal do WhatsApp não configurado ' +
          '(EVOLUTION_SYSTEM_INSTANCE / EVOLUTION_SYSTEM_APIKEY).',
      );
      return;
    }

    let email: Email;
    try {
      email = Email.create(command.email);
    } catch {
      return;
    }

    const user = await this.userRepository.findByEmailGlobally(email);
    if (!user || !user.canAuthenticate()) {
      return;
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60_000);
    const sentInLastHour = await this.codeRepository.countSentSince(user.id, oneHourAgo);
    if (sentInLastHour >= MAX_SENDS_PER_HOUR) {
      this.logger.warn('Limite de envios de código atingido', { userId: user.id.value });
      return;
    }

    const plainCode = PasswordResetCode.generatePlainCode();
    const codeHash = await this.passwordHasher.hash(plainCode);

    const code = PasswordResetCode.issue({
      accountId: user.accountId,
      userId: user.id,
      codeHash,
    });

    // Um só código vivo por usuário: pedir um novo invalida o anterior. Dois códigos válidos ao
    // mesmo tempo dobram a superfície de adivinhação. A linha antiga permanece no banco porque é
    // ela que sustenta a contagem de envios da última hora.
    const previous = await this.codeRepository.findLiveByUser(user.id);
    await this.unitOfWork.execute(async () => {
      if (previous) {
        previous.invalidate();
        await this.codeRepository.save(previous);
      }
      await this.codeRepository.save(code);
    });

    try {
      await this.notifier.send({
        to: user.phone,
        name: user.name.split(' ')[0],
        code: plainCode,
        expiresInMinutes: PasswordResetCode.TTL_MINUTES,
      });

      code.markSent();
      await this.unitOfWork.execute(async () => {
        await this.codeRepository.save(code);
      });
    } catch (error) {
      // O código NÃO entra no log — nem aqui, nem em erro (CLAUDE.md). E a falha de envio não
      // marca `sent_at`: se marcasse, uma indisponibilidade do WhatsApp consumiria a cota do
      // usuário sem que nenhuma mensagem tivesse chegado.
      this.logger.error('Falha ao enviar código de recuperação', {
        userId: user.id.value,
        error: (error as Error)?.message,
      });
    }
  }
}
