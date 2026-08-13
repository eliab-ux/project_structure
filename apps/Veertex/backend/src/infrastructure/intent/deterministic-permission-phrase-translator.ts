import { Injectable, Logger } from '@nestjs/common';
import {
  PermissionPhraseRequest,
  PermissionPhraseTranslatorPort,
} from '../../contexts/role/application/ports/output/permission-phrase-translator.port';
import { PermissionVerdict } from '../../contexts/role/domain/permission-phrase';
import { PERMISSIONS } from '../../contexts/role/domain/permissions.catalog';

/**
 * Tradutor DETERMINÍSTICO de frase → permissões. Adapter de teste e de desenvolvimento sem chave.
 *
 * Mesmo papel do `DeterministicIntentParser`, e as mesmas duas regras: **não é fallback de
 * produção** (o adapter real recusa quando a chave falta, nunca delega para cá), e é grosseiro de
 * propósito — reconhece verbo e área, e deixa todo o resto em `undecided`, que é exatamente o
 * comportamento que a tela precisa exercitar.
 *
 * Ele existe para que o teste do fluxo inteiro não dependa de chamada externa paga e não
 * determinística. O que ele NÃO faz é entender português: "a Ana pode vender" não vira nada aqui,
 * porque `vender` não é permissão do CORE — e inventar um mapeamento faria o teste passar mentindo.
 */
@Injectable()
export class DeterministicPermissionPhraseTranslator implements PermissionPhraseTranslatorPort {
  private readonly logger = new Logger(DeterministicPermissionPhraseTranslator.name);

  /**
   * Palavras que denunciam a ÁREA, e as permissões que cada uma alcança.
   *
   * Só o CORE, porque só o CORE existe no catálogo hoje (`permissions.catalog.ts` diz isso
   * explicitamente). Quando um módulo trouxer o seu bloco de permissões, acrescenta-se aqui — e um
   * gatilho para permissão inexistente seria descartado pelo domínio de todo modo.
   */
  private static readonly AREA_TRIGGERS: { words: string[]; permissions: string[] }[] = [
    {
      words: ['empresa', 'empresas', 'filial', 'filiais', 'cnpj'],
      permissions: Object.values(PERMISSIONS.companies),
    },
    {
      words: ['usuário', 'usuario', 'usuários', 'usuarios', 'pessoa', 'pessoas', 'equipe'],
      permissions: Object.values(PERMISSIONS.users),
    },
    {
      words: ['papel', 'papéis', 'papeis', 'permissão', 'permissões', 'permissao', 'permissoes'],
      permissions: Object.values(PERMISSIONS.roles),
    },
    {
      words: ['conta', 'assinatura', 'plano', 'módulo', 'modulo', 'módulos', 'modulos'],
      permissions: Object.values(PERMISSIONS.account),
    },
  ];

  /** Verbos que restringem a decisão a uma AÇÃO dentro da área. */
  private static readonly ACTION_TRIGGERS: { words: string[]; suffix: string }[] = [
    { words: ['ver', 'consultar', 'olhar', 'enxergar', 'acessar'], suffix: 'read' },
    { words: ['criar', 'cadastrar', 'incluir', 'abrir'], suffix: 'create' },
    { words: ['alterar', 'editar', 'mudar', 'atualizar', 'mexer'], suffix: 'update' },
    { words: ['excluir', 'apagar', 'remover', 'deletar'], suffix: 'delete' },
    { words: ['desativar', 'bloquear', 'inativar'], suffix: 'disable' },
  ];

  ensureAvailable(): void {
    // Sempre disponível: não depende de rede nem de credencial.
  }

  async translate(request: PermissionPhraseRequest): Promise<PermissionVerdict[]> {
    const verdicts: PermissionVerdict[] = [];

    for (const line of request.lines) {
      const lower = line.toLowerCase();

      // A negação é procurada ANTES da área: numa linha só, "não pode mexer em empresa" e "pode
      // mexer em empresa" citam a mesma área e decidem o oposto. É por isso que o §5.1 quebra a
      // frase em linhas — o "mas" separa a concessão da restrição.
      const negated = /\bn[ãa]o\b/.test(lower);

      const areas = DeterministicPermissionPhraseTranslator.AREA_TRIGGERS.filter((area) =>
        area.words.some((word) => lower.includes(word)),
      );
      if (areas.length === 0) {
        continue;
      }

      const actions = DeterministicPermissionPhraseTranslator.ACTION_TRIGGERS.filter((action) =>
        action.words.some((word) => lower.includes(word)),
      ).map((action) => action.suffix);

      for (const area of areas) {
        const targets =
          actions.length === 0
            ? area.permissions
            : area.permissions.filter((permission) =>
                actions.includes(permission.split('.').pop() as string),
              );

        for (const permission of targets) {
          verdicts.push({
            permission,
            decision: negated ? 'denied' : 'granted',
            // O trecho é a LINHA, literal. Nunca uma paráfrase: a tela mostra isto entre aspas, e o
            // usuário precisa reconhecer o que ele mesmo escreveu.
            quote: line,
            reason: negated
              ? `A linha diz "não", e ela fala de ${permission.split('.')[0]}.`
              : `A linha concede acesso a ${permission.split('.')[0]}.`,
          });
        }
      }
    }

    this.logger.debug('Frase traduzida por palavra-chave', { vereditos: verdicts.length });
    return verdicts;
  }
}
