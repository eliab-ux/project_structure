import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@veertex/shared-kernel';
import { INTENT_PARSER, IntentParserPort } from '../../ports/output/intent-parser.port';
import { describeCommands, IntentApiResult } from '../../../domain/intent-command';
import { AuthorizeIntentCommandUseCase } from '../authorize-intent-command/authorize-intent-command.use-case';
import { ImageNoticeRequiredException } from '../../../domain/intent-exceptions';

export class ParseIntentCommand {
  constructor(
    public readonly text: string,
    /** Do TOKEN. */
    public readonly permissions: readonly string[],
    /** Do TOKEN. */
    public readonly activeModules: readonly string[],
    /** A imagem, quando houver. Processada e descartada — nunca persistida. */
    public readonly attachment?: { mimeType: string; dataBase64: string },
    /** Quando o aviso ao titular foi exibido. Obrigatório se houver imagem. */
    public readonly noticeAcknowledgedAt?: string,
    /** Do TOKEN — para o registro do aviso dizer QUEM viu. */
    public readonly actingUserId?: string,
    /** Do TOKEN. */
    public readonly accountId?: string,
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
export class ParseIntentUseCase implements UseCase<ParseIntentCommand, IntentApiResult> {
  private readonly logger = new Logger(ParseIntentUseCase.name);

  constructor(
    @Inject(INTENT_PARSER) private readonly parser: IntentParserPort,
    private readonly authorize: AuthorizeIntentCommandUseCase,
  ) {}

  /**
   * O tradutor configurado sabe ler imagem?
   *
   * Perguntado ao PORT, não deduzido de variável de ambiente: quem sabe responder é a implementação
   * que está no container. Ler o `INTENT_PARSER_DRIVER` aqui seria uma segunda fonte de verdade
   * sobre qual adapter está ativo, e as duas divergiriam no dia em que a escolha mudasse.
   */
  supportsAttachment(): boolean {
    return this.parser.supportsAttachment === true;
  }

  async execute(command: ParseIntentCommand): Promise<IntentApiResult> {
    this.parser.ensureAvailable();

    /*
     * O AVISO AO TITULAR — exigido, e registrado.
     *
     * A imagem é de um documento de terceiro: o titular não é parte do contrato entre o Veertex e a
     * conta, e não tem como saber que a foto dele foi enviada a um provedor externo. O aviso não
     * resolve isso sozinho — quem obtém o consentimento é o operador, e o aviso diz isso a ele —,
     * mas sem o aviso ninguém sequer sabe que houve envio.
     *
     * Recusar sem o campo é o que impede a tela de "esquecer" de exibi-lo: um cliente que pule o
     * aviso não consegue enviar imagem. Se a checagem fosse só na tela, a primeira refatoração de
     * UI a removeria sem ninguém notar.
     */
    if (command.attachment) {
      if (!command.noticeAcknowledgedAt) {
        throw new ImageNoticeRequiredException();
      }
      // Sem a imagem e sem o texto do operador no log — só o fato, quem, quando.
      this.logger.log('Aviso ao titular exibido antes do envio de imagem', {
        accountId: command.accountId,
        actingUserId: command.actingUserId,
        exibidoEm: command.noticeAcknowledgedAt,
        mimeType: command.attachment.mimeType,
      });
    }

    const availableCommands = this.authorize.availableFor(
      command.permissions,
      command.activeModules,
    );

    if (availableCommands.length === 0) {
      // Papel sem nenhuma permissão de escrita: nada a propor. Responder "não sei fazer isso" é
      // honesto e não revela quais comandos existem para quem não pode executá-los — por isso
      // `available` sai VAZIO, e não com o catálogo. A lista é o que ESTE ator pode fazer.
      this.logger.log('Nenhum comando disponível para este ator');
      return { command: null, guess: null, screenHint: null, available: [] };
    }

    // O texto do operador NÃO vai para log — é dado de negócio do cliente, e um log de intenções é o
    // registro de tudo o que se tentou fazer na conta.
    const result = await this.parser.parse({
      text: command.text,
      availableCommands,
      attachment: command.attachment,
    });

    this.logger.log('Intenção processada', {
      reconhecido: result.command !== null,
      comandosDisponiveis: availableCommands.length,
    });

    if (result.command === null) {
      // A recusa sai acompanhada do que este ator pode fazer. `availableCommands` é exatamente a
      // lista que o tradutor recebeu — a tela não pode oferecer nada além do que foi autorizado a
      // propor, senão a recusa passaria a ser o canal por onde capacidade indisponível é anunciada.
      return { ...result, available: describeCommands(availableCommands) };
    }

    return result;
  }
}
