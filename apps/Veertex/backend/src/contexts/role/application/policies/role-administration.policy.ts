import { Inject, Injectable, Logger } from '@nestjs/common';
import { PERMISSIONS, grants } from '../../domain/permissions.catalog';
import { ROLE_REPOSITORY, RoleRepositoryPort } from '../ports/output/role-repository.port';
import {
  USER_REPOSITORY,
  UserRepositoryPort,
} from '../../../user/application/ports/output/user-repository.port';
import { AccountWouldLoseRoleAdministrationException } from '../../domain/exceptions/role-exceptions';

/**
 * A alteração que se quer aplicar, para ser simulada ANTES de acontecer.
 *
 * Simular em memória, e não aplicar-conferir-desfazer, porque desfazer depende de rollback — e o
 * rollback é justamente o mecanismo que já nos custou o contador de tentativas do reset de senha
 * (ver ADR-0004). Uma checagem que só é verdadeira se a transação sobreviver não é uma checagem.
 */
export type AccountChange =
  | { kind: 'role-permissions'; roleId: string; permissions: string[] }
  | { kind: 'user-status'; userId: string; active: boolean }
  | { kind: 'user-role'; userId: string; roleId: string };

/**
 * Impede que uma conta fique sem NENHUM usuário ativo capaz de administrar papéis.
 *
 * **Por que isto existe.** DECIDIDO (Eliab, 11/08/2026): não está em nenhum requisito — é decisão de
 * produto tomada junto com a liberação da edição dos papéis de sistema (§3.3 — "ajustáveis por
 * conta"). Assim que ADMIN passou a ser editável, ficou possível remover `roles.update` de todo
 * mundo, e daí em diante **nada dentro do produto reverte**: sem quem edite papéis, não há como
 * devolver a permissão a ninguém. O conserto exigiria acesso ao banco, feito pelo suporte, um
 * cliente por vez.
 *
 * **Por que `roles.update` e não `*`.** As travas anteriores contavam papéis e usuários
 * "administrativos", e `isAdministrative` significa ter o curinga `*`. Isso deixava um buraco real:
 * um papel com `['roles.read','roles.create','roles.update','roles.delete']` administra papéis
 * plenamente e NÃO era contado. Uma conta cujos usuários estivessem todos nesse papel podia ter o
 * último deles desabilitado sem que trava alguma reagisse — e ficava trancada. A pergunta certa não
 * é "quem tem o curinga", é "quem consegue devolver permissão a alguém".
 *
 * `roles.update` é a capacidade mínima de recuperação: quem a tem pode reescrever qualquer papel,
 * inclusive o próprio, e portanto conceder-se o que falte. Sem ela, nenhuma outra permissão traz a
 * conta de volta.
 */
@Injectable()
export class RoleAdministrationPolicy {
  private readonly logger = new Logger(RoleAdministrationPolicy.name);

  constructor(
    @Inject(ROLE_REPOSITORY) private readonly roles: RoleRepositoryPort,
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
  ) {}

  /**
   * Lança se a alteração deixaria a conta sem administrador de papéis.
   *
   * Carrega papéis e usuários da conta inteira. São dezenas de linhas no pior caso realista, e as
   * duas consultas já vêm escopadas pelo filtro global — a alternativa, contar em SQL, exigiria
   * reimplementar `grants()` (com resolução de curinga por segmento) em Postgres, em duas
   * linguagens que divergiriam na primeira mudança da regra.
   */
  async assertSurvives(change: AccountChange): Promise<void> {
    const [roles, users] = await Promise.all([this.roles.listAll(), this.users.listAll()]);

    const permissionsByRole = new Map(
      roles.map((role) => [
        role.id.value,
        change.kind === 'role-permissions' && change.roleId === role.id.value
          ? change.permissions
          : [...role.permissions.values],
      ]),
    );

    const survivors = users.filter((user) => {
      const active =
        change.kind === 'user-status' && change.userId === user.id.value
          ? change.active
          : user.isActive;
      if (!active) {
        return false;
      }

      const roleId =
        change.kind === 'user-role' && change.userId === user.id.value
          ? change.roleId
          : user.roleId;

      return grants(permissionsByRole.get(roleId) ?? [], PERMISSIONS.roles.update);
    });

    if (survivors.length === 0) {
      // Sem id de usuário nem de papel na mensagem ao cliente; o contexto fica no log interno.
      this.logger.warn('Alteração recusada por deixar a conta sem administrador de papéis', {
        changeKind: change.kind,
      });
      throw new AccountWouldLoseRoleAdministrationException();
    }
  }
}
