import { ValueObject } from '@gitspread/domain-primitives';
import { InvalidGroupJidException } from '../exceptions/invalid-group-jid.exception';

interface Props {
  value: string;
}

/**
 * JID de um grupo do WhatsApp: `1203630xxxxxxxxx@g.us`.
 *
 * O sufixo `@g.us` é o que distingue grupo de contato individual (`@s.whatsapp.net`). Validar
 * isso aqui impede que um JID de pessoa física chegue ao envio: a mensagem diária iria para o
 * privado de alguém em vez do grupo.
 */
export class GroupJid extends ValueObject<Props> {
  private constructor(props: Props) {
    super(props);
  }

  static create(value: string): GroupJid {
    const trimmed = (value ?? '').trim();
    if (!/^[0-9]{5,30}(-[0-9]{1,20})?@g\.us$/.test(trimmed)) {
      throw new InvalidGroupJidException();
    }
    return new GroupJid({ value: trimmed });
  }

  static isValid(value: string): boolean {
    try {
      GroupJid.create(value);
      return true;
    } catch {
      return false;
    }
  }

  get value(): string {
    return this.props.value;
  }
}
