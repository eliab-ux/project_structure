import { InvalidValueException } from '../../../../shared/domain/exceptions/invalid-value.exception';

/**
 * Os três papéis da segregação de função (spec §5). O conjunto é fechado por controle interno,
 * não por limitação técnica: se o Modelista pudesse agendar e receber, ele poderia operar fora do
 * caixa. Não acrescente papel sem que a tabela da §5 diga o que ele pode fazer em cada linha.
 */
export const USER_ROLES = ['owner', 'admin', 'modelista'] as const;

export type UserRole = (typeof USER_ROLES)[number];

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value);
}

export function assertUserRole(value: unknown): UserRole {
  if (!isUserRole(value)) {
    throw new InvalidValueException('Papel inválido. Use owner, admin ou modelista.');
  }
  return value;
}

/** Rótulos da UI (português), separados do identificador técnico (inglês) — regra §0.5. */
export const USER_ROLE_LABELS: Record<UserRole, string> = {
  owner: 'Dono',
  admin: 'Administrativo',
  modelista: 'Modelista',
};
