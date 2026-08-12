import { randomBytes } from 'node:crypto';
import { Client } from 'pg';
import {
  CreateRoleCommand,
  CreateRoleUseCase,
} from '../../src/contexts/role/application/use-cases/create-role/create-role.use-case';
import {
  UpdateRoleCommand,
  UpdateRoleUseCase,
} from '../../src/contexts/role/application/use-cases/update-role/update-role.use-case';
import {
  CreateUserCommand,
  CreateUserUseCase,
} from '../../src/contexts/user/application/use-cases/create-user/create-user.use-case';
import {
  SetUserStatusCommand,
  SetUserStatusUseCase,
} from '../../src/contexts/user/application/use-cases/set-user-status/set-user-status.use-case';
import {
  UpdateUserCommand,
  UpdateUserUseCase,
} from '../../src/contexts/user/application/use-cases/update-user/update-user.use-case';
import { ListRolesUseCase } from '../../src/contexts/role/application/use-cases/list-roles/list-roles.use-case';
import { ListUsersUseCase } from '../../src/contexts/user/application/use-cases/list-users/list-users.use-case';
import { UseCaseHarness, createUseCaseHarness } from '../helpers/use-case-harness';
import { runCli } from '../helpers/run-cli';
import { connectAsOwner, deleteAccountsByDocument } from '../helpers/db';
import { cnpjWithCheckDigits } from '../helpers/document';

/**
 * A trava contra auto-lockout: a conta nunca fica sem um usuário ATIVO capaz de administrar papéis.
 *
 * DECIDIDO (Eliab, 11/08/2026). Não está em requisito nenhum — é decisão de produto tomada junto
 * com a liberação da edição dos papéis de sistema (§3.3, "ajustáveis por conta"). Sem a trava, três
 * operações banais levam a um estado que **nada dentro do produto reverte**: editar o papel
 * removendo `roles.update`, desabilitar o último usuário que o tem, ou movê-lo para outro papel.
 *
 * O teste que importa aqui é o do papel com `roles.update` EXPLÍCITO, sem curinga. As travas
 * anteriores contavam quem tem `*`, e por isso não viam esse caso — uma conta inteira em papel
 * explícito podia ser trancada sem que nada reagisse.
 */

const ACCOUNT = {
  document: cnpjWithCheckDigits('900000100001'),
  email: 'lockout@teste.veertex.local',
  password: randomBytes(15).toString('base64url'),
};

describe('Trava anti-lockout de administração de papéis', () => {
  let owner: Client;
  let harness: UseCaseHarness;
  let accountId: string;
  let adminUserId: string;
  let adminRoleId: string;

  const roleByCode = async (code: string): Promise<string> => {
    const roles = await harness.asAccount(accountId, () =>
      harness.app.get(ListRolesUseCase).execute(),
    );
    return roles.find((role) => role.code === code)!.id;
  };

  beforeAll(async () => {
    owner = await connectAsOwner();
    await deleteAccountsByDocument(owner, [ACCOUNT.document]);

    const created = await runCli(
      'create-account.cli.ts',
      [
        '--account-name',
        'Conta do Lockout',
        '--account-document',
        ACCOUNT.document,
        '--plan',
        'COMPLETO',
        '--company-legal-name',
        'Conta do Lockout Ltda',
        '--company-document',
        ACCOUNT.document,
        '--tax-regime',
        'SIMPLES',
        '--state-registration-exempt',
        '--street',
        'Rua do Lockout',
        '--number',
        '1',
        '--district',
        'Centro',
        '--city',
        'Goiania',
        '--state',
        'GO',
        '--zip',
        '74000000',
        '--admin-name',
        'Admin do Lockout',
        '--admin-email',
        ACCOUNT.email,
        '--admin-phone',
        '62999990030',
      ],
      { VEERTEX_ADMIN_PASSWORD: ACCOUNT.password },
    );
    if (created.exitCode !== 0) {
      throw new Error(`Pré-condição falhou:\n${created.output}`);
    }

    const { rows } = await owner.query<{ account_id: string; user_id: string; role_id: string }>(
      `select a.id as account_id, u.id as user_id, u.role_id
         from accounts a join users u on u.account_id = a.id
        where a.document = $1`,
      [ACCOUNT.document],
    );
    accountId = rows[0].account_id;
    adminUserId = rows[0].user_id;
    adminRoleId = rows[0].role_id;

    harness = await createUseCaseHarness();
  }, 180_000);

  afterAll(async () => {
    if (harness) {
      await harness.close();
    }
    await deleteAccountsByDocument(owner, [ACCOUNT.document]);
    await owner.end();
  });

  it('permite EDITAR papel de sistema — §3.3, ajustáveis por conta', async () => {
    // A revalidação do que foi revertido: uma versão da tela bloqueava isso, e o §3.3 não pede.
    const managerId = await roleByCode('MANAGER');

    const updated = await harness.asAccount(accountId, () =>
      harness.app
        .get(UpdateRoleUseCase)
        .execute(new UpdateRoleCommand(managerId, 'Gestor de Loja', null, ['companies.read'])),
    );

    expect(updated.name).toBe('Gestor de Loja');
    expect(updated.permissions).toEqual(['companies.read']);
    expect(updated.isSystem).toBe(true);
  });

  it('recusa remover roles.update do último papel que o concede', async () => {
    await expect(
      harness.asAccount(accountId, () =>
        harness.app
          .get(UpdateRoleUseCase)
          .execute(new UpdateRoleCommand(adminRoleId, undefined, undefined, ['companies.read'])),
      ),
    ).rejects.toThrow(/administrar papéis/i);
  });

  it('recusa desabilitar o último usuário que administra papéis', async () => {
    // Um segundo usuário, em papel SEM roles.update: a conta continua com um só administrador.
    const cashierId = await roleByCode('CASHIER');
    const second = await harness.asAccount(accountId, () =>
      harness.app
        .get(CreateUserUseCase)
        .execute(
          new CreateUserCommand(
            accountId,
            'Operador',
            'operador-lockout@teste.veertex.local',
            '62999990031',
            'senha-forte-lockout',
            cashierId,
          ),
        ),
    );

    // Desabilitar o operador é permitido — ele não administra papéis.
    await expect(
      harness.asAccount(accountId, () =>
        harness.app
          .get(SetUserStatusUseCase)
          .execute(new SetUserStatusCommand(second.id, false, adminUserId)),
      ),
    ).resolves.toBeDefined();

    // Desabilitar o admin, não. `actingUserId` é outro para não bater na trava de auto-desabilitar,
    // que é uma regra diferente e cobriria o caso por acidente.
    await expect(
      harness.asAccount(accountId, () =>
        harness.app
          .get(SetUserStatusUseCase)
          .execute(new SetUserStatusCommand(adminUserId, false, second.id)),
      ),
    ).rejects.toThrow(/administrar papéis/i);
  });

  it('recusa mover o último administrador para um papel sem roles.update', async () => {
    const cashierId = await roleByCode('CASHIER');

    await expect(
      harness.asAccount(accountId, () =>
        harness.app
          .get(UpdateUserUseCase)
          .execute(new UpdateUserCommand(adminUserId, undefined, undefined, undefined, cashierId)),
      ),
    ).rejects.toThrow(/administrar papéis/i);
  });

  describe('o buraco que a trava antiga tinha: roles.update EXPLÍCITO, sem curinga', () => {
    let explicitRoleId: string;
    let explicitUserId: string;

    beforeAll(async () => {
      // Papel que administra papéis plenamente e NÃO tem `*`. Sob a definição antiga
      // (`isAdministrative` = ter curinga) ele não era contado como administrativo.
      const role = await harness.asAccount(accountId, () =>
        harness.app
          .get(CreateRoleUseCase)
          .execute(
            new CreateRoleCommand(
              accountId,
              'ADMIN_EXPLICITO',
              'Admin Explícito',
              ['roles.read', 'roles.create', 'roles.update', 'roles.delete', 'users.read'],
              null,
            ),
          ),
      );
      explicitRoleId = role.id;

      const user = await harness.asAccount(accountId, () =>
        harness.app
          .get(CreateUserUseCase)
          .execute(
            new CreateUserCommand(
              accountId,
              'Admin Explícito',
              'admin-explicito@teste.veertex.local',
              '62999990032',
              'senha-forte-lockout',
              explicitRoleId,
            ),
          ),
      );
      explicitUserId = user.id;
    });

    it('com ele ativo, o admin de curinga PODE perder roles.update', async () => {
      // Agora há dois caminhos de recuperação, então mexer num deles é seguro. É a prova de que a
      // trava conta capacidade e não curinga: sob a regra antiga, contar papéis com `*` daria 1 e
      // esta operação legítima seria recusada.
      const updated = await harness.asAccount(accountId, () =>
        harness.app
          .get(UpdateRoleUseCase)
          .execute(
            new UpdateRoleCommand(adminRoleId, undefined, undefined, [
              'companies.read',
              'users.read',
            ]),
          ),
      );

      expect(updated.permissions).not.toContain('*');
    });

    it('e agora desabilitar o usuário do papel explícito é recusado', async () => {
      // O caso que a trava antiga deixava passar: o único administrador restante está num papel sem
      // curinga, `countActiveAdministrators()` devolveria 0, e a guarda nem disparava.
      await expect(
        harness.asAccount(accountId, () =>
          harness.app
            .get(SetUserStatusUseCase)
            .execute(new SetUserStatusCommand(explicitUserId, false, adminUserId)),
        ),
      ).rejects.toThrow(/administrar papéis/i);
    });

    it('a conta continua com exatamente um administrador de papéis', async () => {
      const users = await harness.asAccount(accountId, () =>
        harness.app.get(ListUsersUseCase).execute(),
      );
      const roles = await harness.asAccount(accountId, () =>
        harness.app.get(ListRolesUseCase).execute(),
      );

      const administering = users.filter((user) => {
        if (user.status !== 'ACTIVE') {
          return false;
        }
        const permissions = roles.find((role) => role.id === user.roleId)?.permissions ?? [];
        return permissions.includes('*') || permissions.includes('roles.update');
      });

      expect(administering.map((user) => user.id)).toEqual([explicitUserId]);
    });
  });
});
