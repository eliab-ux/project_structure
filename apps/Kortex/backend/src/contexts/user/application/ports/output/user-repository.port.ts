import { User } from '../../../domain/entities/user.entity';
import { AccountId } from '../../../../account/domain/value-objects/account-id.vo';
import { UserId } from '../../../domain/value-objects/user-id.vo';
import { Email } from '../../../../../shared/domain/value-objects/email.vo';

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

export interface UserRepositoryPort {
  listByAccount(accountId: AccountId): Promise<User[]>;
  findById(accountId: AccountId, id: UserId): Promise<User | null>;
  save(user: User): Promise<User>;

  /**
   * Busca GLOBAL por e-mail — a única consulta do sistema deliberadamente fora do escopo de conta.
   *
   * Tem de ser assim: no login o usuário informa e-mail e senha, e é justamente esta consulta que
   * descobre a qual conta ele pertence. Não existe `accountId` para filtrar antes de saber quem
   * ele é. Por isso o e-mail é único no sistema inteiro (`user_email_unique`) — é o que garante
   * que a resposta seja no máximo um usuário.
   *
   * Nenhuma outra consulta deve seguir este exemplo. O verificador `check:tenant-scope` conhece
   * esta exceção pelo nome do método.
   */
  findByEmailGlobally(email: Email): Promise<User | null>;
}
