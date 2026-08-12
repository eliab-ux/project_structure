import { DomainException } from '@gitspread/domain-primitives';

/**
 * O canal de tradução está inutilizável — chave ausente, provedor fora, resposta ilegível.
 *
 * Surge ao chamador, diferente do reset de senha (onde a falha de canal é silenciada para não virar
 * oráculo de enumeração). Aqui não há o que enumerar: o operador já está autenticado e a falha não diz
 * nada sobre a existência de conta alguma. O que se protege é o tempo dele — saber que o canal caiu é
 * melhor do que ver a intenção sumir sem explicação.
 */
export class IntentChannelUnavailableException extends DomainException {
  constructor() {
    super(
      'Não foi possível interpretar sua solicitação agora. Use as telas do menu ou tente novamente ' +
        'em alguns minutos.',
    );
  }
}

/**
 * O comando existe no catálogo, mas o papel de quem pediu não pode executá-lo.
 *
 * O nome começa com "Forbidden" porque o `GlobalExceptionFilter` deriva o status HTTP do nome da
 * classe (`*Forbidden*` → 403) — é como o domínio se mantém sem conceito de HTTP dentro.
 *
 * ⚠️ Esta exceção é a materialização do §8 da especificação: *"A IA não é caminho paralelo de
 * autorização"*. Um comando pedido por texto e um pedido por clique falham do MESMO jeito, com a
 * MESMA permissão verificada pela MESMA função. Se o papel não pode alterar permissões, pedir por
 * escrito também não pode.
 */
export class ForbiddenIntentCommandException extends DomainException {
  constructor(label: string) {
    super(`Seu papel não permite: ${label}.`);
  }
}

/**
 * O comando pertence a um módulo que a conta não tem ativo.
 *
 * Recusado ANTES da permissão, na mesma ordem que o `ModuleGuard` usa no caminho HTTP (ADR-0001:
 * módulo verificado primeiro). Ordem diferente entre os dois caminhos produziria mensagens diferentes
 * para o mesmo impedimento — e o §3 é explícito: módulo inativo nunca é proposto.
 */
export class IntentModuleInactiveException extends DomainException {
  constructor(moduleCode: string) {
    super(`Esta ação depende do módulo ${moduleCode}, que não está ativo nesta conta.`);
  }
}

/** Comando que não está no catálogo — texto forjado no cliente, ou catálogo mudado sob o cliente. */
export class UnknownIntentCommandException extends DomainException {
  constructor() {
    super('Ação desconhecida. Recarregue a página e tente novamente.');
  }
}

/**
 * O rascunho chegou sem um campo que o comando exige.
 *
 * Recusado na aprovação, nomeando os campos que faltam. A alternativa — repassar `null` ao Use Case —
 * produziria erro de Value Object com mensagem sobre invariante de domínio, que não diz ao operador o
 * que ele deixou de preencher.
 *
 * ⚠️ Este é o ponto em que a regra "não suponha" deixa de ser comentário. O §2 manda o tradutor
 * devolver `null` + `review` para o que a frase não disse; se a aprovação preenchesse a lacuna com um
 * padrão, teria desfeito todo o desenho — e o operador aprovaria um valor que ninguém escolheu.
 */
export class IncompleteIntentDraftException extends DomainException {
  constructor(missing: string[]) {
    super(
      `Faltam informações para concluir: ${missing.join(', ')}. Preencha os campos marcados para ` +
        'revisão e aprove novamente.',
    );
  }
}
