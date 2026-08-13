import { DomainException } from '@veertex/domain-primitives';

export class UnknownModuleException extends DomainException {
  constructor(code: string) {
    // Código de módulo é informação pública do catálogo — seguro ecoar, e é o que torna a mensagem
    // acionável para quem digitou errado.
    super(`Módulo desconhecido: ${code}.`);
  }
}

/**
 * O plano da conta não inclui o módulo. Mensagem aponta para o caminho comercial, não para o
 * suporte — quem vê isso precisa saber que existe upgrade, não abrir chamado.
 */
export class ModuleNotInPlanException extends DomainException {
  constructor(code: string) {
    super(`O módulo ${code} não faz parte do seu plano. Faça upgrade para ativá-lo.`);
  }
}

export class CoreModuleNotToggleableException extends DomainException {
  constructor(code: string) {
    super(`O módulo ${code} é parte da fundação do sistema e não pode ser desativado.`);
  }
}

/** Ativar exige que as dependências já estejam ativas. */
export class ModuleDependencyMissingException extends DomainException {
  constructor(code: string, missing: readonly string[]) {
    super(`Para ativar ${code}, ative antes: ${missing.join(', ')}.`);
  }
}

/** Desativar exige que ninguém dependa dele. */
export class ModuleInUseByDependentsException extends DomainException {
  constructor(code: string, dependents: readonly string[]) {
    super(`Não é possível desativar ${code}: ${dependents.join(', ')} depende(m) dele.`);
  }
}

/**
 * Nome contém "Forbidden", que o GlobalExceptionFilter mapeia para HTTP 403.
 *
 * É o que o `ModuleGuard` levanta. Diferente de "sem permissão" de propósito: quem vê isto tem o
 * direito de fazer a operação, o que falta é a conta ter o módulo — e a saída é falar com o
 * administrador ou fazer upgrade, não pedir permissão.
 */
export class ModuleInactiveForbiddenException extends DomainException {
  constructor(code: string) {
    super(`O módulo ${code} não está ativo nesta conta.`);
  }
}
