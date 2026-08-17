import { InvalidValueException } from '../exceptions/invalid-value.exception';

const MIN_LENGTH = 8;
/** Limite do bcrypt: ele ignora tudo além de 72 bytes, então aceitar mais engana o usuário. */
const MAX_LENGTH = 72;

/**
 * Senha em claro, viva apenas entre o request e o hash.
 *
 * **Não** estende `ValueObject`: a base congela `props` e implementa `equals` por
 * `JSON.stringify` — ou seja, colocaria a senha numa string a cada comparação e a exporia em
 * qualquer serialização acidental do objeto. Aqui o valor fica privado, `toJSON` devolve uma
 * máscara e não existe getter público: quem precisa do valor é o hasher, que o recebe pelo
 * método `use()`.
 *
 * A regra de força é a do protótipo (mínimo 8 caracteres). Não há exigência de símbolo ou
 * maiúscula de propósito: comprimento é o que importa, e regra de composição empurra o operador
 * para `Senha@123` e para o post-it no monitor.
 */
export class PlainPassword {
  private readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  static create(raw: string): PlainPassword {
    const value = raw ?? '';

    if (value.length < MIN_LENGTH) {
      throw new InvalidValueException(`A senha deve ter pelo menos ${MIN_LENGTH} caracteres.`);
    }
    if (Buffer.byteLength(value, 'utf8') > MAX_LENGTH) {
      throw new InvalidValueException(`A senha deve ter no máximo ${MAX_LENGTH} caracteres.`);
    }
    if (value.trim().length === 0) {
      throw new InvalidValueException('A senha não pode ser só espaços.');
    }

    return new PlainPassword(value);
  }

  /** Único caminho para o valor. Use apenas para hashear ou comparar. */
  use<T>(consumer: (plain: string) => T): T {
    return consumer(this.value);
  }

  /** Protege contra o log acidental — `JSON.stringify(command)` não vaza a senha. */
  toJSON(): string {
    return '[senha omitida]';
  }

  toString(): string {
    return '[senha omitida]';
  }
}
