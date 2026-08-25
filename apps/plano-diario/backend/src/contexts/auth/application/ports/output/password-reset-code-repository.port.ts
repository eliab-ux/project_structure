import { PasswordResetCode } from '../../../domain/entities/password-reset-code.entity';

export const PASSWORD_RESET_CODE_REPOSITORY = Symbol('PASSWORD_RESET_CODE_REPOSITORY');

export interface PasswordResetCodeRepositoryPort {
  save(code: PasswordResetCode): Promise<PasswordResetCode>;
  /**
   * O código mais recente ainda não usado do usuário. Só um vale por vez: pedir um novo invalida
   * o anterior, senão dois códigos vivos dobrariam a superfície de adivinhação.
   */
  findLatestUnused(userId: string): Promise<PasswordResetCode | null>;
  /**
   * Base do limite de solicitações — evita usar o WhatsApp do usuário como canal de spam.
   *
   * Conta apenas os códigos **efetivamente enviados**. Contar tentativas fazia uma falha de
   * infraestrutura (canal sem configuração, por exemplo) consumir a cota do usuário e travar a
   * recuperação por uma hora sem que uma única mensagem tivesse saído.
   */
  countSentSince(userId: string, since: Date): Promise<number>;
  /** Marca como usados todos os códigos vivos do usuário (após uma troca bem-sucedida). */
  invalidateAllForUser(userId: string, now: Date): Promise<void>;
}
