import { randomBytes } from 'node:crypto';
import { Client } from 'pg';
import {
  LoginCommand,
  LoginUseCase,
} from '../../src/contexts/auth/application/use-cases/login/login.use-case';
import {
  GetCurrentAccountQuery,
  GetCurrentAccountUseCase,
} from '../../src/contexts/account/application/use-cases/get-current-account/get-current-account.use-case';
import {
  CreateUserCommand,
  CreateUserUseCase,
} from '../../src/contexts/user/application/use-cases/create-user/create-user.use-case';
import { ListUsersUseCase } from '../../src/contexts/user/application/use-cases/list-users/list-users.use-case';
import { UseCaseHarness, createUseCaseHarness } from '../helpers/use-case-harness';
import { runCli } from '../helpers/run-cli';
import { connectAsOwner, deleteAccountsByDocument } from '../helpers/db';
import { cnpjWithCheckDigits } from '../helpers/document';

/**
 * Use Cases de auth, account e user — por INTEGRAÇÃO, com RLS valendo.
 *
 * Duas contas, sempre. Uma só não prova isolamento: com um único tenant, uma consulta sem escopo
 * devolve exatamente o mesmo resultado de uma escopada, e o vazamento passa despercebido até
 * produção. Os testes que importam neste arquivo são os que pedem dados de B enquanto o escopo é A.
 *
 * As contas nascem pela CLI real (`create:account`), e não por INSERT: o hash de senha precisa ser
 * o que o onboarding produz, porque a compatibilidade entre quem grava e quem confere é justamente
 * o que o login exercita. Custa ~12 segundos por conta e vale o preço.
 */

const ACCOUNT_A = {
  document: cnpjWithCheckDigits('900000050001'),
  name: 'Conta A',
  email: 'admin-a@teste.veertex.local',
  password: randomBytes(15).toString('base64url'),
};
const ACCOUNT_B = {
  document: cnpjWithCheckDigits('900000060001'),
  name: 'Conta B',
  email: 'admin-b@teste.veertex.local',
  password: randomBytes(15).toString('base64url'),
};

type Fixture = typeof ACCOUNT_A & { id: string; adminRoleId: string };

async function createAccount(spec: typeof ACCOUNT_A): Promise<void> {
  const result = await runCli(
    'create-account.cli.ts',
    [
      '--account-name',
      spec.name,
      '--account-document',
      spec.document,
      '--plan',
      'COMPLETO',
      '--company-legal-name',
      `${spec.name} Ltda`,
      '--company-document',
      spec.document,
      '--tax-regime',
      'SIMPLES',
      '--state-registration-exempt',
      '--street',
      'Rua de Teste',
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
      `Admin ${spec.name}`,
      '--admin-email',
      spec.email,
      '--admin-phone',
      '62999990011',
    ],
    { VEERTEX_ADMIN_PASSWORD: spec.password },
  );

  if (result.exitCode !== 0) {
    throw new Error(`Pré-condição falhou ao criar ${spec.name}:\n${result.output}`);
  }
}

describe('Use Cases de auth, account e user — integração com RLS', () => {
  let owner: Client;
  let harness: UseCaseHarness;
  let a: Fixture;
  let b: Fixture;

  beforeAll(async () => {
    owner = await connectAsOwner();
    await deleteAccountsByDocument(owner, [ACCOUNT_A.document, ACCOUNT_B.document]);

    await createAccount(ACCOUNT_A);
    await createAccount(ACCOUNT_B);

    const resolve = async (spec: typeof ACCOUNT_A): Promise<Fixture> => {
      const { rows } = await owner.query<{ id: string; role_id: string }>(
        `select a.id, r.id as role_id
           from accounts a join roles r on r.account_id = a.id and r.code = 'ADMIN'
          where a.document = $1`,
        [spec.document],
      );
      return { ...spec, id: rows[0].id, adminRoleId: rows[0].role_id };
    };

    a = await resolve(ACCOUNT_A);
    b = await resolve(ACCOUNT_B);

    harness = await createUseCaseHarness();
  }, 180_000);

  afterAll(async () => {
    if (harness) {
      await harness.close();
    }
    await deleteAccountsByDocument(owner, [ACCOUNT_A.document, ACCOUNT_B.document]);
    await owner.end();
  });

  describe('login', () => {
    it('autentica e devolve o tenant do próprio usuário', async () => {
      const result = await harness.unscoped(() =>
        harness.app.get(LoginUseCase).execute(new LoginCommand(a.email, a.password, '127.0.0.1')),
      );

      expect(result.accountId).toBe(a.id);
      expect(result.accessToken).toBeTruthy();
      expect(Array.isArray(result.permissions)).toBe(true);
    });

    it('não permite que a senha de uma conta abra a outra', async () => {
      // O par (e-mail de A, senha de B) é o teste que pega hash comparado contra o usuário errado.
      await expect(
        harness.unscoped(() =>
          harness.app.get(LoginUseCase).execute(new LoginCommand(a.email, b.password, null)),
        ),
      ).rejects.toThrow();
    });

    it('responde a e-mail inexistente igual a senha errada', async () => {
      // Sem oráculo de enumeração: as duas recusas têm de ser indistinguíveis para quem chama.
      const wrongPassword = await harness
        .unscoped(() =>
          harness.app.get(LoginUseCase).execute(new LoginCommand(a.email, 'nao-e-a-senha', null)),
        )
        .catch((error: Error) => error);
      const unknownEmail = await harness
        .unscoped(() =>
          harness.app
            .get(LoginUseCase)
            .execute(new LoginCommand('ninguem@teste.veertex.local', 'nao-e-a-senha', null)),
        )
        .catch((error: Error) => error);

      expect(wrongPassword).toBeInstanceOf(Error);
      expect(unknownEmail).toBeInstanceOf(Error);
      expect((unknownEmail as Error).message).toBe((wrongPassword as Error).message);
      expect((unknownEmail as Error).constructor).toBe((wrongPassword as Error).constructor);
    });
  });

  describe('conta corrente', () => {
    it('cada escopo enxerga a própria conta', async () => {
      const fromA = await harness.asAccount(a.id, () =>
        harness.app.get(GetCurrentAccountUseCase).execute(new GetCurrentAccountQuery(a.id)),
      );
      const fromB = await harness.asAccount(b.id, () =>
        harness.app.get(GetCurrentAccountUseCase).execute(new GetCurrentAccountQuery(b.id)),
      );

      expect(fromA.account.name).toBe(ACCOUNT_A.name);
      expect(fromB.account.name).toBe(ACCOUNT_B.name);
    });

    it('escopo de A pedindo o id de B não devolve dados de B', async () => {
      // O teste central. Mesmo que um id alheio chegue ao Use Case — por bug de controller, por
      // parâmetro forjado, por qualquer caminho —, o RLS e o filtro global têm de impedir a leitura.
      const attempt = await harness
        .asAccount(a.id, () =>
          harness.app.get(GetCurrentAccountUseCase).execute(new GetCurrentAccountQuery(b.id)),
        )
        .catch((error: Error) => error);

      if (attempt instanceof Error) {
        // Recusa é resultado aceitável.
        expect(attempt).toBeInstanceOf(Error);
      } else {
        // Se não recusou, então de forma alguma pode ter trazido os dados de B.
        expect(attempt.account?.name).not.toBe(ACCOUNT_B.name);
      }
    });
  });

  describe('usuários', () => {
    it('lista apenas os usuários da própria conta', async () => {
      const fromA = await harness.asAccount(a.id, () =>
        harness.app.get(ListUsersUseCase).execute(),
      );
      const fromB = await harness.asAccount(b.id, () =>
        harness.app.get(ListUsersUseCase).execute(),
      );

      expect(fromA.map((user) => user.email)).toEqual([ACCOUNT_A.email]);
      expect(fromB.map((user) => user.email)).toEqual([ACCOUNT_B.email]);
    });

    it('cria usuário na própria conta sem afetar a outra', async () => {
      const email = 'novo-a@teste.veertex.local';

      await harness.asAccount(a.id, () =>
        harness.app
          .get(CreateUserUseCase)
          .execute(
            new CreateUserCommand(
              a.id,
              'Novo de A',
              email,
              '62999990012',
              'senha-forte-1',
              a.adminRoleId,
            ),
          ),
      );

      const fromA = await harness.asAccount(a.id, () =>
        harness.app.get(ListUsersUseCase).execute(),
      );
      const fromB = await harness.asAccount(b.id, () =>
        harness.app.get(ListUsersUseCase).execute(),
      );

      expect(fromA.map((user) => user.email).sort()).toEqual([ACCOUNT_A.email, email].sort());
      expect(fromB).toHaveLength(1);
    });

    it('recusa e-mail repetido dentro da mesma conta', async () => {
      await expect(
        harness.asAccount(a.id, () =>
          harness.app
            .get(CreateUserUseCase)
            .execute(
              new CreateUserCommand(
                a.id,
                'Repetido',
                ACCOUNT_A.email,
                '62999990013',
                'senha-forte-2',
                a.adminRoleId,
              ),
            ),
        ),
      ).rejects.toThrow();
    });

    it('recusa usuário sem telefone', async () => {
      // Regra 9 do CLAUDE.md: não existe usuário autenticável sem WhatsApp, porque a recuperação de
      // senha é por código no WhatsApp. Um usuário sem número perde a conta no primeiro esquecimento.
      await expect(
        harness.asAccount(a.id, () =>
          harness.app
            .get(CreateUserUseCase)
            .execute(
              new CreateUserCommand(
                a.id,
                'Sem Telefone',
                'sem-telefone@teste.veertex.local',
                '',
                'senha-forte-3',
                a.adminRoleId,
              ),
            ),
        ),
      ).rejects.toThrow();
    });

    it('recusa papel de outra conta', async () => {
      // Papel é entidade escopada. Aceitar o roleId de B numa conta A criaria um usuário apontando
      // para permissões de outro tenant.
      await expect(
        harness.asAccount(a.id, () =>
          harness.app
            .get(CreateUserUseCase)
            .execute(
              new CreateUserCommand(
                a.id,
                'Papel Alheio',
                'papel-alheio@teste.veertex.local',
                '62999990014',
                'senha-forte-4',
                b.adminRoleId,
              ),
            ),
        ),
      ).rejects.toThrow();
    });
  });
});
