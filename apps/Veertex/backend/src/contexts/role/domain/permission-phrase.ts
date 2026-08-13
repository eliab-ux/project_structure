import { ALL_PERMISSIONS } from './permissions.catalog';

/**
 * A tradução de uma frase em permissões — §5.1 da especificação de frontend.
 *
 * > "A Ana pode vender, mas não pode mexer em preço nem dar desconto."
 *
 * Dono de loja não conhece `contacts.credit_limit.edit`; conhece a frase. Esta é a estrutura que a
 * tela recebe para mostrar a tradução **linha a linha**, cada permissão com estado e com o trecho
 * que a originou.
 */

/**
 * Os três estados. O terceiro é o que sustenta a tela inteira.
 *
 * `undecided` **não é ausência de resposta — é a resposta**: a frase não falou daquela permissão, e
 * o sistema não vai supor. Sem este estado só haveria dois destinos para o silêncio, e ambos são
 * defeitos: resolver como `granted` inventa poder que ninguém concedeu; resolver como `denied`
 * tira poder que ninguém quis tirar, e o usuário só descobre quando alguém não consegue trabalhar.
 * É a regra de não-default-silencioso renderizada em UI.
 */
export type PermissionDecision = 'granted' | 'denied' | 'undecided';

export interface PermissionVerdict {
  permission: string;
  decision: PermissionDecision;
  /**
   * O TRECHO LITERAL da frase que originou a decisão — a evidência, não uma paráfrase.
   *
   * `null` quando `undecided`, e a nulidade é significativa: não há trecho porque a frase não
   * disse. Uma paráfrase aqui ("o usuário parece querer vender") permitiria ao tradutor justificar
   * qualquer coisa com texto que ninguém escreveu.
   */
  quote: string | null;
  /** O porquê, em português, para a tela exibir ao lado do estado. */
  reason: string;
}

export interface PermissionPhraseReading {
  /** A frase quebrada nas orações que a tela numera — é o "linha a linha" do §5.1. */
  lines: string[];
  /** UMA entrada por permissão do catálogo. Ver `completeWithUndecided`. */
  verdicts: PermissionVerdict[];
}

export const UNDECIDED_REASON = 'Sua frase não disse — não vou supor.';

/**
 * Completa a leitura com TODAS as permissões do catálogo que o tradutor não citou.
 *
 * **Esta função é a garantia, e por isso mora no domínio e não no adapter.** Um tradutor — LLM ou
 * palavra-chave — que simplesmente omitisse uma permissão faria a tela não a mostrar, e uma
 * permissão invisível é uma decisão tomada por omissão. Aqui o catálogo é a fonte: o que o tradutor
 * não decidiu volta como `undecided`, explicitamente, e o humano decide.
 *
 * Também descarta o que o tradutor inventou: string fora de `ALL_PERMISSIONS` não vira veredito.
 * Nunca confie na saída do modelo (CLAUDE.md, Princípio 2).
 */
export function completeWithUndecided(
  translated: readonly PermissionVerdict[],
): PermissionVerdict[] {
  const byPermission = new Map<string, PermissionVerdict>();

  for (const verdict of translated) {
    if (!ALL_PERMISSIONS.includes(verdict.permission)) {
      continue; // permissão inexistente proposta pelo tradutor — descartada em silêncio
    }
    if (byPermission.has(verdict.permission)) {
      continue; // duplicata: a primeira vale, para a leitura ser determinística
    }
    byPermission.set(verdict.permission, {
      permission: verdict.permission,
      // Sem trecho de evidência, "permitido" e "negado" não se sustentam: viram afirmação sem
      // origem. Rebaixar para `undecided` é a única saída que não inventa nem esconde.
      decision: verdict.quote ? verdict.decision : 'undecided',
      quote: verdict.quote ?? null,
      reason: verdict.quote ? verdict.reason : UNDECIDED_REASON,
    });
  }

  return ALL_PERMISSIONS.map(
    (permission) =>
      byPermission.get(permission) ?? {
        permission,
        decision: 'undecided' as const,
        quote: null,
        reason: UNDECIDED_REASON,
      },
  );
}

/**
 * Quebra a frase nas orações que a tela numera.
 *
 * Por ponto, ponto-e-vírgula, quebra de linha e pelos conectivos que separam concessão em português
 * falado ("mas", "porém", "só que") — que é exatamente onde mora a inversão de sentido: *"pode
 * vender, **mas** não pode dar desconto"*. Separar ali faz a linha que nega ficar visível como
 * linha própria, em vez de escondida no fim de uma frase longa.
 */
export function splitPhraseIntoLines(phrase: string): string[] {
  return phrase
    .split(/[.;\n]|\s+(?:mas|porém|porem|só que|so que|todavia|entretanto)\s+/i)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}
