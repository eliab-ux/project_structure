import { DomainException } from '@gitspread/domain-primitives';

/**
 * Duas janelas do mesmo dia se cruzam. Vira 400.
 *
 * A mesma regra existe como constraint de exclusão no banco (`business_hour_no_overlap`). Isso não
 * é redundância: a validação aqui produz a mensagem que o operador entende, e a do banco é o que
 * garante a regra quando duas telas salvam ao mesmo tempo — entre o `select` que não viu conflito
 * e o `insert` que o cria cabe uma segunda requisição.
 */
export class OverlappingBusinessHourException extends DomainException {
  constructor(existing: string, candidate: string) {
    super(
      `A janela ${candidate} se sobrepõe à janela ${existing} já cadastrada neste dia. ` +
        'O intervalo é o espaço entre uma janela e a seguinte.',
    );
  }
}
