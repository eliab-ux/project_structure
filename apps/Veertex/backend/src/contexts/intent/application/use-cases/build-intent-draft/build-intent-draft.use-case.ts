import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { INTENT_COMMANDS, IntentField } from '../../../domain/intent-command';
import {
  AuthorizeIntentCommandQuery,
  AuthorizeIntentCommandUseCase,
} from '../authorize-intent-command/authorize-intent-command.use-case';

export class BuildIntentDraftCommand {
  constructor(
    public readonly command: string,
    public readonly fields: Record<string, IntentField>,
    /** Do TOKEN. */
    public readonly permissions: readonly string[],
    /** Do TOKEN. */
    public readonly activeModules: readonly string[],
  ) {}
}

export interface IntentDraft {
  /**
   * Identificador do rascunho. **Existe no contrato, mas o rascunho NÃO é persistido nesta fatia.**
   *
   * DECIDIDO (Eliab, 12/08/2026): contrato estável, implementação temporária. Sem o `draftId` desde
   * já, a tabela — quando vier — obrigaria a mexer nos três endpoints e no cliente. Com ele, a
   * persistência entra sem contrato novo.
   *
   * Consequência honesta: o rascunho morre ao recarregar a página, e isso **comunica a verdade do
   * sistema** — nada foi gravado. A lista "Já preparei — falta você olhar" (§4.1) depende da tabela e
   * está registrada como fatia futura em `DEPENDENCIAS_EXTERNAS.md`, com as três decisões em aberto.
   */
  draftId: string;
  command: string;
  label: string;
  fields: Record<string, IntentField>;
  /** Campos que exigem decisão humana, no topo (§6.2). */
  reviewFields: string[];
  /** Quantas aprovações este rascunho custa. O §4.1 pede peso visual para isso. */
  approvals: number;
}

/**
 * Monta o rascunho a partir do plano traduzido. **Nenhuma escrita** — o §2 é explícito: humano grava,
 * e a aprovação explícita por etapa é o único caminho de escrita.
 *
 * Autoriza ANTES de montar. Montar primeiro e recusar depois gastaria o trabalho e, pior, exibiria ao
 * operador um rascunho de algo que ele não pode fazer — o que o §3 chama de propor o que não deveria
 * ser proposto.
 *
 * **Campos sem procedência sobem para revisão, sempre.** Um valor cuja origem o tradutor não soube
 * declarar é um valor que ninguém pode conferir, e aprovar sem conferir é o que o §6.4 chama de
 * treinar o usuário a aprovar sem ler.
 */
@Injectable()
export class BuildIntentDraftUseCase implements UseCase<BuildIntentDraftCommand, IntentDraft> {
  private readonly logger = new Logger(BuildIntentDraftUseCase.name);

  constructor(private readonly authorize: AuthorizeIntentCommandUseCase) {}

  async execute(command: BuildIntentDraftCommand): Promise<IntentDraft> {
    const name = this.authorize.execute(
      new AuthorizeIntentCommandQuery(command.command, command.permissions, command.activeModules),
    );

    const fields = Object.fromEntries(
      Object.entries(command.fields ?? {}).map(([field, incoming]) => {
        const value = incoming?.value ?? null;
        const origin = incoming?.origin ?? null;
        return [
          field,
          {
            value,
            origin,
            // Sem valor ou sem procedência → revisão obrigatória, independentemente do que o cliente
            // mandou. O cliente pode alegar `review: false`; não é ele quem decide.
            review: value === null || origin === null ? true : incoming.review === true,
          },
        ];
      }),
    );

    // CreateRole: `code` é identificador interno (A-Z0-9_) que ninguém dita — o approve o exige, e
    // um rascunho sem ele morria em 400 sem o operador ter o que preencher (defeito real,
    // 23/08/2026). Derivado do nome e EXIBIDO com origem 'padrao': o operador aprova o que vê;
    // colisão de code responde como mensagem de negócio na aprovação.
    if (name === 'CreateRole' && !fields.code?.value && typeof fields.name?.value === 'string') {
      fields.code = {
        value: deriveRoleCode(fields.name.value),
        origin: 'padrao',
        review: false,
      };
    }

    const reviewFields = Object.entries(fields)
      .filter(([, field]) => field.review)
      .map(([name_]) => name_);

    this.logger.log('Rascunho montado', { command: name, camposEmRevisao: reviewFields.length });

    return {
      draftId: randomUUID(),
      command: name,
      label: INTENT_COMMANDS[name].label,
      fields,
      reviewFields,
      // Uma aprovação por etapa. Hoje todo comando do catálogo é uma etapa só; um comando composto
      // (contato + pedido, como no §4.1 do protótipo) custaria duas, e o número existe no contrato
      // desde já para a tela não precisar mudar quando isso acontecer.
      approvals: 1,
    };
  }
}

/** Nome → código de papel: sem acento, A-Z0-9_ (o formato que a entidade Role valida), 2–30. */
function deriveRoleCode(name: string): string {
  const code = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 30);
  return code.length >= 2 ? code : 'PAPEL';
}
