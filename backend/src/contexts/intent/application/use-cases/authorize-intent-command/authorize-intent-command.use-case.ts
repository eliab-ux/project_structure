import { Injectable, Logger } from '@nestjs/common';
import { grants } from '../../../../role/domain/permissions.catalog';
import {
  INTENT_COMMANDS,
  IntentCommandName,
  isKnownIntentCommand,
} from '../../../domain/intent-command';
import {
  ForbiddenIntentCommandException,
  IntentModuleInactiveException,
  UnknownIntentCommandException,
} from '../../../domain/intent-exceptions';

export class AuthorizeIntentCommandQuery {
  constructor(
    public readonly command: string,
    /** Do TOKEN, nunca do corpo da requisição. */
    public readonly permissions: readonly string[],
    /** Do TOKEN — `plano ∩ conta` resolvido no login (ADR-0001). */
    public readonly activeModules: readonly string[],
  ) {}
}

/**
 * Decide se um comando de intenção pode ser executado por quem pediu. **É o §8 da especificação
 * virando código:** *"A IA não é caminho paralelo de autorização. Comando emitido pelo modelo passa
 * pelos mesmos guards que um clique."*
 *
 * O que faz isso ser verdade, e não promessa:
 *
 *  1. A permissão exigida vem do `INTENT_COMMANDS`, onde cada comando declara **a mesma** permissão
 *     que o controller equivalente exige no `@RequirePermission`.
 *  2. A verificação usa **a mesma função** `grants()` que o `PermissionGuard` usa — incluindo a
 *     resolução de curinga por segmento. Reimplementar a comparação aqui seria criar uma segunda
 *     interpretação de permissão, e é entre duas interpretações que a divergência mora.
 *  3. Permissões e módulos vêm do TOKEN. Se viessem do corpo, quem chamasse a rota escolheria as
 *     próprias permissões — o que transformaria a rota de intenção em escalada de privilégio.
 *
 * **Ordem: módulo antes de permissão.** É a mesma do caminho HTTP (`ModuleGuard` estende
 * `JwtAuthGuard` e roda antes do `PermissionGuard`, ADR-0001). Ordem diferente entre os dois caminhos
 * produziria mensagens diferentes para o mesmo impedimento — e, pior, contaria a quem não tem
 * permissão que o módulo está ativo.
 *
 * Chamado DUAS vezes num fluxo completo: ao montar o rascunho e outra vez ao aprovar. Não é
 * redundância — entre as duas chamadas o cliente segurou o rascunho, e um papel pode ter sido
 * alterado nesse intervalo. Confiar na primeira verificação é confiar num estado que já passou.
 */
@Injectable()
export class AuthorizeIntentCommandUseCase {
  private readonly logger = new Logger(AuthorizeIntentCommandUseCase.name);

  execute(query: AuthorizeIntentCommandQuery): IntentCommandName {
    if (!isKnownIntentCommand(query.command)) {
      // Nome fora do catálogo: cliente desatualizado, ou corpo forjado. As duas respostas são a
      // mesma, e nenhuma diz o que existe no catálogo.
      this.logger.warn('Comando de intenção desconhecido recusado');
      throw new UnknownIntentCommandException();
    }

    const definition = INTENT_COMMANDS[query.command];

    if (definition.requiredModule && !query.activeModules.includes(definition.requiredModule)) {
      this.logger.warn('Comando de intenção recusado por módulo inativo', {
        command: query.command,
        module: definition.requiredModule,
      });
      throw new IntentModuleInactiveException(definition.requiredModule);
    }

    if (!grants(query.permissions, definition.requiredPermission)) {
      // Sem o id do usuário na mensagem ao cliente; o contexto fica no log interno.
      this.logger.warn('Comando de intenção recusado por falta de permissão', {
        command: query.command,
        required: definition.requiredPermission,
      });
      throw new ForbiddenIntentCommandException(definition.label);
    }

    return query.command;
  }

  /**
   * Os comandos que este ator pode executar agora — `plano ∩ conta ∩ papel`, os três.
   *
   * Usado para (a) montar a lista que o tradutor recebe e (b) a Mesa não propor o que seria recusado.
   * **Filtrar aqui é conveniência, não segurança:** o §8 diz que esconder não é proteger, e a fronteira
   * continua sendo o `execute()` acima, chamado na aprovação. O filtro existe para não treinar o
   * operador a colecionar recusas.
   */
  availableFor(
    permissions: readonly string[],
    activeModules: readonly string[],
  ): IntentCommandName[] {
    return (Object.keys(INTENT_COMMANDS) as IntentCommandName[]).filter((name) => {
      const definition = INTENT_COMMANDS[name];
      const moduleOk =
        !definition.requiredModule || activeModules.includes(definition.requiredModule);
      return moduleOk && grants(permissions, definition.requiredPermission);
    });
  }
}
