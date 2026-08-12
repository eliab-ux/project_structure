import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { INTENT_PARSER, IntentParserPort } from '../../ports/output/intent-parser.port';
import { IntentResult } from '../../../domain/intent-command';
import { AuthorizeIntentCommandUseCase } from '../authorize-intent-command/authorize-intent-command.use-case';

export class ParseIntentCommand {
  constructor(
    public readonly text: string,
    /** Do TOKEN. */
    public readonly permissions: readonly string[],
    /** Do TOKEN. */
    public readonly activeModules: readonly string[],
  ) {}
}

/**
 * Traduz o texto do operador em um plano de comando. **Não grava nada.**
 *
 * O tradutor recebe apenas os comandos que este ator poderia executar — `plano ∩ conta ∩ papel`. Duas
 * razões, e a primeira é do produto:
 *
 *  - o §3 diz que **módulo inativo nunca é proposto**; oferecer o comando ao tradutor é convidá-lo a
 *    propor exatamente isso;
 *  - propor o que a aprovação recusaria treina o operador a colecionar recusas, e um sistema que
 *    promete e nega ensina a não ler o que promete.
 *
 * Filtrar aqui **não** é a proteção: a proteção é a autorização na aprovação. Se o filtro falhasse e
 * um comando indevido fosse proposto, o `approve` ainda recusaria — que é a ordem certa das camadas
 * (§8: "esconder não é proteger").
 *
 * `ensureAvailable()` antes de tudo: descobrir que o canal caiu depois de o operador ter escrito a
 * intenção é gastar o tempo dele para nada.
 */
@Injectable()
export class ParseIntentUseCase implements UseCase<ParseIntentCommand, IntentResult> {
  private readonly logger = new Logger(ParseIntentUseCase.name);

  constructor(
    @Inject(INTENT_PARSER) private readonly parser: IntentParserPort,
    private readonly authorize: AuthorizeIntentCommandUseCase,
  ) {}

  async execute(command: ParseIntentCommand): Promise<IntentResult> {
    this.parser.ensureAvailable();

    const availableCommands = this.authorize.availableFor(
      command.permissions,
      command.activeModules,
    );

    if (availableCommands.length === 0) {
      // Papel sem nenhuma permissão de escrita: nada a propor. Responder "não sei fazer isso" é
      // honesto e não revela quais comandos existem para quem não pode executá-los.
      this.logger.log('Nenhum comando disponível para este ator');
      return { command: null, guess: null, screenHint: null };
    }

    // O texto do operador NÃO vai para log — é dado de negócio do cliente, e um log de intenções é o
    // registro de tudo o que se tentou fazer na conta.
    const result = await this.parser.parse({ text: command.text, availableCommands });

    this.logger.log('Intenção processada', {
      reconhecido: result.command !== null,
      comandosDisponiveis: availableCommands.length,
    });

    return result;
  }
}
