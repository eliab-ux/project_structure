import { PasswordResetCode } from '../../../domain/entities/password-reset-code.entity';
import { UserId } from '../../../../user/domain/value-objects/user-id.vo';

export const PASSWORD_RESET_CODE_REPOSITORY = Symbol('PASSWORD_RESET_CODE_REPOSITORY');

export interface PasswordResetCodeRepositoryPort {
  /** O único código vivo do usuário (não usado), o mais recente. */
  findLiveByUser(userId: UserId): Promise<PasswordResetCode | null>;
  /** Base do limite por hora — conta ENVIOS, por isso filtra por `sent_at`, não por `created_at`. */
  countSentSince(userId: UserId, since: Date): Promise<number>;
  save(code: PasswordResetCode): Promise<PasswordResetCode>;
}
