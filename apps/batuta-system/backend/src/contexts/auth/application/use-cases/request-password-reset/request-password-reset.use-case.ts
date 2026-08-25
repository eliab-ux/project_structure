import { randomInt } from 'crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  USER_REPOSITORY,
  UserRepositoryPort,
} from '../../../../user/application/ports/output/user-repository.port';
import { Email } from '../../../../user/domain/value-objects/email.vo';
import {
  AuditAction,
  AuditActorType,
} from '../../../../audit/domain/value-objects/audit-action.vo';
import { RecordAuditLogUseCase } from '../../../../audit/application/use-cases/record-audit-log.use-case';
import {
  PasswordResetCode,
  RESET_CODE_TTL_MINUTES,
} from '../../../domain/entities/password-reset-code.entity';
import { PASSWORD_HASHER, PasswordHasherPort } from '../../ports/output/password-hasher.port';
import {
  PASSWORD_RESET_CODE_REPOSITORY,
  PasswordResetCodeRepositoryPort,
} from '../../ports/output/password-reset-code-repository.port';
import {
  RESET_CODE_MESSENGER,
  ResetCodeMessengerPort,
} from '../../ports/output/reset-code-messenger.port';
import { RequestPasswordResetCommand } from './request-password-reset.command';

/** How many codes a user may ask for per hour. Keeps their WhatsApp from becoming a spam channel. */
const MAX_REQUESTS_PER_HOUR = 3;

/**
 * Sends a six-digit code over the platform's WhatsApp.
 *
 * **This use case never reveals whether an account exists.** Every refusal path — unknown e-mail,
 * disabled user, no WhatsApp on file, hourly limit reached — ends the same way: no exception, no
 * different return. The caller always answers 204. The distinction lives in the log, which is
 * internal.
 *
 * The one thing that DOES surface is a broken channel, and it is checked first, before the user is
 * looked up: if it were checked later, a real e-mail would fail while an unknown one answered 204 —
 * handing an attacker the list of accounts that exist.
 */
@Injectable()
export class RequestPasswordResetUseCase implements UseCase<RequestPasswordResetCommand, void> {
  private readonly logger = new Logger(RequestPasswordResetUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(PASSWORD_RESET_CODE_REPOSITORY)
    private readonly codes: PasswordResetCodeRepositoryPort,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasherPort,
    @Inject(RESET_CODE_MESSENGER) private readonly messenger: ResetCodeMessengerPort,
    private readonly audit: RecordAuditLogUseCase,
  ) {}

  async execute(command: RequestPasswordResetCommand): Promise<void> {
    // FIRST, before touching the database — see the class comment.
    this.messenger.ensureAvailable();

    // The one unscoped read of the flow: there is no JWT here, so the e-mail is the only identifier.
    const user = await this.users.findByEmailForAuthentication(Email.create(command.email));

    if (!user || !user.isActive) {
      this.logger.log('Recuperação pedida para conta inexistente ou inativa; nada enviado');
      return;
    }
    if (!user.phone) {
      // A row created before the phone column existed. Nothing to send to, and nothing to tell the
      // caller either — the answer has to look identical to the success case.
      this.logger.warn('Conta sem WhatsApp cadastrado pediu recuperação', {
        userId: user.id.value,
      });
      return;
    }

    const now = new Date();
    const recentSends = await this.codes.countSentSince(
      user.id.value,
      new Date(now.getTime() - 60 * 60_000),
    );
    if (recentSends >= MAX_REQUESTS_PER_HOUR) {
      this.logger.warn('Limite de solicitações por hora atingido', { userId: user.id.value });
      return;
    }

    // One live code at a time: two valid codes would double the guessing surface.
    await this.codes.invalidateAllForUser(user.id.value, now);

    const code = RequestPasswordResetUseCase.generateCode();
    // Persisted BEFORE the send. In the other order, a failed write would leave the user holding a
    // code the system does not recognise.
    const issued = await this.codes.save(
      PasswordResetCode.issue({
        accountId: user.accountId,
        userId: user.id.value,
        // Same hashing as a password — the plaintext exists only in this function and in the
        // message the user receives.
        codeHash: await this.hasher.hash(code),
        now,
      }),
    );

    try {
      await this.messenger.sendResetCode({
        phoneE164: user.phone.value,
        name: user.name.split(' ')[0],
        code,
        expiresInMinutes: RESET_CODE_TTL_MINUTES,
      });
    } catch {
      // Swallowed, and this is the subtle part: letting a send failure become a 500 would mean a
      // registered e-mail answers 500 while an unknown one answers 204 — the enumeration oracle
      // this whole use case exists to avoid, reintroduced through the error path.
      //
      // `sentAt` stays null, so the failed attempt does not consume the user's hourly quota; the
      // detail is in the log, where the operator sees it and the caller does not.
      this.logger.error('Código gerado, mas o envio pelo WhatsApp falhou', {
        userId: user.id.value,
      });
      return;
    }

    // Written only here, after the send actually succeeded.
    issued.markSent();
    await this.codes.save(issued);

    await this.audit.execute({
      accountId: user.accountId,
      actorType: AuditActorType.USER,
      actorId: user.id.value,
      action: AuditAction.PASSWORD_RESET_REQUESTED,
      entityType: 'user',
      entityId: user.id.value,
      ip: command.ip,
      // No code, no phone number, no hash. Only that it happened and how long it lasts.
      payload: { channel: 'WHATSAPP', expiresInMinutes: RESET_CODE_TTL_MINUTES },
    });

    this.logger.log('Código de recuperação enviado', { userId: user.id.value });
  }

  /**
   * Six digits from `randomInt` of `node:crypto`. `Math.random()` is predictable and unfit for
   * generating a secret. `padStart` keeps `000123` six characters long, so no code is shorter — and
   * therefore easier to guess — than another.
   */
  private static generateCode(): string {
    return String(randomInt(0, 1_000_000)).padStart(6, '0');
  }
}
