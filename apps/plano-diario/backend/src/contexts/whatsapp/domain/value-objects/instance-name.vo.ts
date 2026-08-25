import { ValueObject } from '@gitspread/domain-primitives';
import { InvalidInstanceNameException } from '../exceptions/invalid-instance-name.exception';

interface Props {
  value: string;
}

/**
 * Nome da instância na Evolution API. Derivado do id do usuário (`pd_{uuid sem hífens}`), nunca
 * escolhido pelo cliente: o nome é o identificador da instância no servidor compartilhado, então
 * deixar o usuário definir permitiria colidir — ou sequestrar — a instância de outro sistema.
 *
 * O prefixo `pd_` isola as instâncias deste app das dos outros (o EMDR usa `emdr-*`).
 */
export class InstanceName extends ValueObject<Props> {
  static readonly PREFIX = 'pd_';

  private constructor(props: Props) {
    super(props);
  }

  static forUser(userId: string): InstanceName {
    const normalized = (userId ?? '').replace(/-/g, '').toLowerCase();
    if (!/^[0-9a-f]{32}$/.test(normalized)) {
      throw new InvalidInstanceNameException();
    }
    return new InstanceName({ value: `${InstanceName.PREFIX}${normalized}` });
  }

  /** Reconstrução a partir do banco — valida o formato que nós mesmos gravamos. */
  static from(value: string): InstanceName {
    if (!/^pd_[0-9a-f]{32}$/.test(value ?? '')) {
      throw new InvalidInstanceNameException();
    }
    return new InstanceName({ value });
  }

  get value(): string {
    return this.props.value;
  }
}
