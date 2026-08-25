import { BindingConstraintReport } from './schedule-builder';

export interface BindingExplanation {
  /** One sentence naming the real cause, with the number that produced it. */
  reason: string;
  /** Actions that ACTUALLY change this outcome, most effective first. */
  options: string[];
}

/**
 * Turns the binding ceiling into something an operator can act on (Adendo 02 §3.2).
 *
 * Why this is a domain service and not UI text: the rules being explained ARE the domain — the quota,
 * the reserve, the cascade order. Two screens phrasing them differently would eventually contradict each
 * other about the same numbers, which is the same reason the health assessment is computed in the domain
 * rather than coloured in the client.
 *
 * The failure this replaces was concrete. A plan showed "6 contatos não cabem nesta janela" with three
 * generic options, when the truth was that the chip's daily quota was spent (15 of 16) and the window
 * ended before another day could open. The operator read it as "the system cannot send 6 messages in an
 * hour" — a reasonable conclusion from a wrong explanation, and a wrong belief about the one mechanism the
 * whole product exists to protect.
 *
 * Two rules the options follow:
 *
 *  1. **Never suggest something that will not help.** "Adicionar canais" under an ACCOUNT_CEILING is the
 *     exact trap §3.1 describes: money spent, no gain, and the conclusion that the system is broken.
 *  2. **Say the cost of the option, not only the option.** Raising the quota floor does work, and it also
 *     shortens a new chip's warm-up. An operator who is not told that will do it and lose the chip.
 */
export function explainBindingConstraint(
  binding: BindingConstraintReport,
  facts: {
    overflowCount: number;
    channelCount: number;
    /** Campaign allowance already spent today, summed across channels. */
    sentToday: number;
    /** Campaign allowance of the day, summed across channels, after the reply reserve. */
    allowanceToday: number;
    accountDailyCeiling: number;
  },
): BindingExplanation {
  const perDay = binding.capacityFirstDay;

  // Said once and reused: it is the half of the answer the old message got wrong, and it applies to
  // every constraint. Throughput and "why did the rest not roll over" are different questions.
  const windowNote = binding.windowExhausted
    ? ' A janela termina antes de abrir outro dia, então o que sobrou não tem para quando ser agendado: ' +
      'estender o fim da janela faz o restante sair no próximo dia permitido, às ' +
      'primeiras horas da manhã.'
    : '';

  switch (binding.constraint) {
    case 'CHANNEL_QUOTA':
      return {
        reason:
          `Limitado pela cota diária dos canais: ${perDay} envio(s) de campanha ainda cabem hoje ` +
          `(${facts.sentToday} de ${facts.allowanceToday} já usados). A cota é a proteção que mantém o ` +
          `chip vivo — parte dela fica reservada para o inbox responder.${windowNote}`,
        options: [
          ...(binding.windowExhausted ? ['Estender o fim da janela para o dia seguinte'] : []),
          'Aguardar a rampa: a cota sobe sozinha após dias com sinais limpos',
          'Adicionar ou reconectar canais (cada chip traz a própria cota)',
          'Subir o piso da cota do canal — resolve na hora, mas encurta o aquecimento do chip',
          'Reduzir o público (filtrar por tag)',
        ],
      };

    case 'ACCOUNT_CEILING':
      return {
        reason:
          `Limitado pelo teto diário da conta: ${perDay} envio(s) restantes hoje de ` +
          `${facts.accountDailyCeiling}/dia. **Adicionar canais não aumenta a vazão** enquanto este ` +
          `teto estiver amarrando, porque ele prevalece sobre a soma dos canais.${windowNote}`,
        options: [
          ...(binding.windowExhausted ? ['Estender o fim da janela para o dia seguinte'] : []),
          'Revisar o teto diário da conta com o suporte',
          'Reduzir o público (filtrar por tag)',
        ],
      };

    case 'HOURLY_CAP':
      return {
        reason:
          `Limitado pelo máximo por hora de cada canal: ${perDay} envio(s) cabem no tempo útil desta ` +
          `janela. O teto por hora existe porque rajada é assinatura de robô, mesmo dentro de um total ` +
          `diário legítimo.${windowNote}`,
        options: [
          'Ampliar a janela diária (mais horas por dia, não mais dias)',
          ...(binding.windowExhausted ? ['Estender o fim da janela para o dia seguinte'] : []),
          'Adicionar ou reconectar canais (o teto por hora é por chip)',
        ],
      };

    case 'WINDOW':
      return {
        reason:
          `Limitado pela janela: só há tempo para ${perDay} envio(s) antes de ` +
          `\`fim da janela\`. Os envios são espaçados de propósito — cadência fixa e rajada são o que ` +
          `derruba chip.${windowNote}`,
        options: [
          'Estender o fim da janela',
          'Adicionar ou reconectar canais (eles enviam em paralelo)',
          'Reduzir o público (filtrar por tag)',
        ],
      };

    case 'QUIET_HOURS':
      return {
        reason:
          `Limitado pelo horário permitido: cabem ${perDay} envio(s) por dia dentro das horas em que ` +
          `a conta pode enviar. Fora desse intervalo nada sai, em nenhuma hipótese.${windowNote}`,
        options: [
          'Ampliar o horário permitido da conta',
          'Estender a janela para mais dias',
          'Adicionar ou reconectar canais',
        ],
      };
  }
}
