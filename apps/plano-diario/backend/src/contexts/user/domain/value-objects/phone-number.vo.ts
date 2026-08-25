import { ValueObject } from '@gitspread/domain-primitives';
import { InvalidPhoneNumberException } from '../exceptions/invalid-phone-number.exception';

interface PhoneNumberProps {
  /** Só dígitos, com código do país: `5511912345678`. */
  value: string;
}

const BRAZIL_COUNTRY_CODE = '55';

/**
 * Número de WhatsApp, guardado sempre em E.164 sem o `+` — que é a forma que a Evolution API
 * espera no campo `number`.
 *
 * A normalização acontece aqui e não na borda HTTP porque o que o usuário digita varia muito
 * ((11) 91234-5678, 11912345678, +55 11 91234-5678) e o banco precisa de uma forma só: é por
 * ela que a recuperação de senha encontra o destinatário.
 */
export class PhoneNumber extends ValueObject<PhoneNumberProps> {
  private constructor(props: PhoneNumberProps) {
    super(props);
  }

  static create(raw: string): PhoneNumber {
    const digits = (raw ?? '').replace(/\D/g, '');
    const withCountry = PhoneNumber.ensureCountryCode(digits);

    if (!PhoneNumber.isValid(withCountry)) {
      throw new InvalidPhoneNumberException();
    }
    return new PhoneNumber({ value: withCountry });
  }

  /**
   * Número brasileiro digitado sem o país (10 ou 11 dígitos) recebe o `55`. Acima disso o valor
   * já vem com código de país e é respeitado — o sistema não é exclusivo do Brasil, só assume
   * Brasil quando o número é curto demais para ter país.
   */
  private static ensureCountryCode(digits: string): string {
    if (digits.length === 10 || digits.length === 11) {
      return `${BRAZIL_COUNTRY_CODE}${digits}`;
    }
    return digits;
  }

  private static isValid(digits: string): boolean {
    // E.164: 8 a 15 dígitos. O piso alto (12) descarta número sem DDD, que é o erro comum.
    if (digits.length < 12 || digits.length > 15) {
      return false;
    }
    if (!digits.startsWith(BRAZIL_COUNTRY_CODE)) {
      // Número estrangeiro: só o formato E.164 genérico é exigido.
      return /^[1-9]\d{7,14}$/.test(digits);
    }

    // Brasil: DDD de 11 a 99 e assinante com 8 (fixo) ou 9 (celular) dígitos.
    const national = digits.slice(2);
    if (national.length !== 10 && national.length !== 11) {
      return false;
    }
    const ddd = Number(national.slice(0, 2));
    if (ddd < 11 || ddd > 99) {
      return false;
    }
    // Celular brasileiro tem 11 dígitos e o nono dígito é sempre 9 — é o número que recebe
    // WhatsApp, então um fixo de 10 dígitos aqui provavelmente é DDD digitado errado.
    return national.length === 11 && national[2] === '9';
  }

  /** Como o usuário reconhece: `(11) 91234-5678`. Número estrangeiro sai como veio, com `+`. */
  get formatted(): string {
    const digits = this.props.value;
    if (!digits.startsWith(BRAZIL_COUNTRY_CODE) || digits.length !== 13) {
      return `+${digits}`;
    }
    const ddd = digits.slice(2, 4);
    return `(${ddd}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }

  /**
   * Para mostrar em tela sem expor o número inteiro: `(11) 9****-5678`.
   * Usado na recuperação de senha, onde confirmar "é este mesmo" não deve entregar o número a
   * quem só sabe o e-mail.
   */
  get masked(): string {
    const digits = this.props.value;
    if (digits.length < 6) {
      return '****';
    }
    const tail = digits.slice(-4);
    if (!digits.startsWith(BRAZIL_COUNTRY_CODE) || digits.length !== 13) {
      return `****${tail}`;
    }
    return `(${digits.slice(2, 4)}) ${digits[4]}****-${tail}`;
  }

  get value(): string {
    return this.props.value;
  }
}
