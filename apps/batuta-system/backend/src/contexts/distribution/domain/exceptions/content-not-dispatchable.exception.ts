import { DomainException } from '@gitspread/domain-primitives';

/**
 * §1.4, terceira regra inegociável: "Nenhum envio sem aprovação. Distribuição só executa sobre
 * conteúdo `APPROVED`." Refused at planning AND re-checked at execution — the content can lose its
 * approval between the two (§8.5).
 */
export class ContentNotDispatchableException extends DomainException {
  constructor(status: string) {
    super(
      `Conteúdo em ${status} não pode ser distribuído: só conteúdo APPROVED é enviável. ` +
        'Envie para aprovação antes.',
    );
  }
}
