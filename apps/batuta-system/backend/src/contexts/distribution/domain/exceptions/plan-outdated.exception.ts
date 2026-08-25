import { DomainException } from '@gitspread/domain-primitives';

/**
 * The content changed between the preview and the confirmation.
 *
 * Its own exception rather than reusing ContentNotDispatchableException, because the two say opposite
 * things to the operator: one means "isto não está aprovado", the other means "isto está aprovado, mas
 * não é o que você viu". Reusing the first produced the sentence "Conteúdo em APPROVED não pode ser
 * distribuído", which is self-contradictory and would send someone looking in the wrong place.
 */
export class PlanOutdatedException extends DomainException {
  constructor() {
    super(
      'O conteúdo foi editado depois desta prévia, então o plano não corresponde mais ao texto atual. ' +
        'Refaça o planejamento para gerar uma nova prévia.',
    );
  }
}
