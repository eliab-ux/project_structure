import { ValueObject } from '@gitspread/domain-primitives';
import { InvalidValueException } from '../exceptions/invalid-value.exception';

const BRAZIL_COUNTRY_CODE = '55';
/** E.164: '+' seguido de 8 a 15 dígitos, o primeiro deles diferente de zero. */
const E164 = /^\+[1-9]\d{7,14}$/;

interface PhoneE164Props {
  value: string;
}

/**
 * Telefone em E.164 (`+5562998708893`). Obrigatório em toda entidade autenticável — é por ele que
 * o código de recuperação de senha chega (regra 9 do CLAUDE.md), e usuário sem número é usuário
 * que perde a conta no primeiro esquecimento de senha.
 *
 * A normalização aceita o que o operador realmente digita — `(62) 9 9870-8893`, `62998708893`,
 * `5562998708893`, `+55 62 99870-8893` — porque exigir E.164 na tela transformaria um cadastro de
 * equipe em um exercício de formatação. O DDI 55 só é assumido quando o número tem cara de
 * brasileiro (10 ou 11 dígitos); qualquer outro comprimento exige o `+` explícito, senão um número
 * estrangeiro digitado sem DDI viraria silenciosamente um número brasileiro inexistente.
 */
export class PhoneE164 extends ValueObject<PhoneE164Props> {
  private constructor(props: PhoneE164Props) {
    super(props);
  }

  static create(raw: string): PhoneE164 {
    const value = PhoneE164.normalize(raw ?? '');

    if (!E164.test(value)) {
      throw new InvalidValueException(
        'Telefone inválido. Informe com DDD (ex.: 62 99870-8893) ou no formato internacional.',
      );
    }

    return new PhoneE164({ value });
  }

  private static normalize(raw: string): string {
    const hadPlus = raw.trim().startsWith('+');
    const digits = raw.replace(/\D/g, '');

    if (hadPlus) {
      return `+${digits}`;
    }
    // 10 dígitos = DDD + fixo; 11 = DDD + celular com o 9.
    if (digits.length === 10 || digits.length === 11) {
      return `+${BRAZIL_COUNTRY_CODE}${digits}`;
    }
    // Já veio com o DDI 55 na frente, só faltando o '+'.
    if ((digits.length === 12 || digits.length === 13) && digits.startsWith(BRAZIL_COUNTRY_CODE)) {
      return `+${digits}`;
    }
    return `+${digits}`;
  }

  get value(): string {
    return this.props.value;
  }

  /** Formato que a Evolution API espera no campo `number`: dígitos, sem o '+'. */
  get digits(): string {
    return this.props.value.slice(1);
  }

  toString(): string {
    return this.props.value;
  }
}
