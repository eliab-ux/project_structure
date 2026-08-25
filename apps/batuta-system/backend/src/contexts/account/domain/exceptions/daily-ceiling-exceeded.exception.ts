import { DomainException } from '@gitspread/domain-primitives';

export class DailyCeilingExceededException extends DomainException {
  constructor(requested: number, remaining: number) {
    super(
      `Plano não cabe no teto diário da conta: pedido ${requested}, disponível ${remaining}. ` +
        'Estenda a janela, reduza o público ou aumente o teto.',
    );
  }
}
