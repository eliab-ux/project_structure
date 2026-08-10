import { randomUUID } from 'crypto';
import { Client } from 'pg';
import { EntityManager } from '@mikro-orm/core';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../src/app.module';
import { TenantContextService } from '../../src/infrastructure/security/tenant-context.service';
import {
  ToggleModuleCommand,
  ToggleModuleUseCase,
} from '../../src/contexts/module/application/use-cases/toggle-module/toggle-module.use-case';
import {
  GetEffectiveModulesQuery,
  GetEffectiveModulesUseCase,
} from '../../src/contexts/module/application/use-cases/get-effective-modules/get-effective-modules.use-case';
import {
  ListModulesQuery,
  ListModulesUseCase,
} from '../../src/contexts/module/application/use-cases/list-modules/list-modules.use-case';
import { MODULES } from '../../src/contexts/module/domain/modules.catalog';
import {
  CoreModuleNotToggleableException,
  ModuleInUseByDependentsException,
  ModuleInactiveForbiddenException,
} from '../../src/contexts/module/domain/exceptions/module-exceptions';
import {
  TOKEN_SERVICE,
  TokenServicePort,
} from '../../src/contexts/auth/application/ports/output/token-service.port';
import { ModuleGuard } from '../../src/infrastructure/security/guards/module.guard';
import { makeValidCnpj } from '../helpers/valid-document';

/**
 * Critério de aceite §7.4, **na redação emendada em 10/08/2026**:
 *
 *   "Módulo desativado → 403 no endpoint a partir da renovação do token: imediata para o usuário
 *    que executou o toggle, e em até o TTL do access token (15 min) para os demais usuários da
 *    conta; item some do menu; reativar restaura tudo."
 *
 * O refresh está encodado explicitamente, e não é um detalhe de implementação escondido no teste:
 * é a consequência registrada no ADR-0001. A sequência exercitada é a do critério —
 * desativar → renovar → recusar → reativar → renovar → liberar, com os dados intactos.
 *
 * **A janela também é asseverada**, e não apenas tolerada: um teste que só verificasse o estado
 * pós-refresh deixaria a impressão de que o 403 é imediato para todos. O caso "token anterior ao
 * toggle" prova que a janela existe e é exatamente o que o critério descreve.
 *
 * ── O que este teste NÃO cobre, e por quê ─────────────────────────────────────────────────────
 * A perna "403 no endpoint" ainda não tem endpoint: **nenhum controller usa `@RequireModule`
 * hoje**. O `ModuleController` deliberadamente não usa (desligar o módulo errado trancaria a conta
 * fora da própria tela de módulos), e VND/ROT/EST são fatias futuras. Então aqui o teste vai até a
 * decisão do guard — que é onde o 403 nasce — em vez de fingir um HTTP que não existe. Quando o
 * primeiro controller de módulo chegar, a asserção sobe para o nível de requisição.
 *
 * ⚠️ ESCRITO SEM EXECUÇÃO: o banco não é alcançável da máquina de desenvolvimento (porta externa
 * fechada, por decisão registrada). A primeira execução real é do Eliab, dentro do container.
 */

const OWNER_URL = process.env.DATABASE_URL_MIGRATIONS;
const APP_URL = process.env.DATABASE_URL;
const SKIP = process.env.VEERTEX_SKIP_DB_TESTS === 'true';

describe('Ciclo de vida de módulo — §7.4', () => {
  let owner: Client;
  let em: EntityManager;
  let tenantContext: TenantContextService;
  let toggleModule: ToggleModuleUseCase;
  let getEffectiveModules: GetEffectiveModulesUseCase;
  let listModules: ListModulesUseCase;
  let tokens: TokenServicePort;
  let close: () => Promise<void>;

  const accountId = randomUUID();
  const roleId = randomUUID();
  const userId = randomUUID();
  const planCode = `LIFECYCLE_${randomUUID().slice(0, 6).toUpperCase()}`;

  /** Plano com COB e FIN juntos: é o par que permite exercitar a regra de dependência do §3.7. */
  const PLAN_MODULES = [MODULES.CORE, MODULES.VND, MODULES.EST, MODULES.FIN, MODULES.COB];

  /**
   * Roda um trecho como se fosse uma requisição HTTP: dentro de uma transação e com o escopo do
   * tenant estabelecido. É o que o `TenantTransactionInterceptor` faz em produção — sem isso o GUC
   * fica vazio e o RLS devolve zero linhas, que num teste apareceria como "dado não existe".
   */
  async function asRequest<T>(work: () => Promise<T>): Promise<T> {
    return em.transactional(async () => {
      await tenantContext.establishFromAuthenticatedUser(accountId);
      return work();
    });
  }

  /** O que o login/refresh gravaria no token AGORA — a renovação do §7.4. */
  async function refreshedModules(): Promise<string[]> {
    return asRequest(() => getEffectiveModules.execute(new GetEffectiveModulesQuery(accountId)));
  }

  /** A decisão do guard para um token emitido com os módulos dados. */
  function guardAllows(moduleCode: string, modules: string[]): boolean {
    const guard = new ModuleGuard(
      {
        ...tokens,
        verifyAccessToken: () => ({
          sub: userId,
          accountId,
          roleId,
          permissions: ['*'],
          modules,
        }),
      } as TokenServicePort,
      { establish: () => undefined } as unknown as TenantContextService,
      { getAllAndOverride: () => moduleCode } as never,
    );

    // O request é criado UMA vez e sempre devolvido por referência. Com um literal novo a cada
    // `getRequest()`, o `user` que o JwtAuthGuard grava iria para um objeto e o ModuleGuard leria de
    // outro — o guard veria `modules: []` e recusaria tudo, parecendo que a regra de negócio está
    // certa quando o errado é o dublê.
    const request = { headers: { authorization: 'Bearer t' } };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => () => undefined,
      getClass: () => class {},
    } as never;

    try {
      return guard.canActivate(context);
    } catch (error) {
      // SÓ a recusa por módulo inativo vira `false`. Qualquer outro erro é relançado: um helper que
      // transformasse tudo em "recusado" faria um bug de fiação parecer a regra de negócio
      // funcionando — e foi o que quase aconteceu aqui.
      if (error instanceof ModuleInactiveForbiddenException) {
        return false;
      }
      throw error;
    }
  }

  beforeAll(async () => {
    if (SKIP) {
      return;
    }
    if (!OWNER_URL || !APP_URL) {
      throw new Error(
        'DATABASE_URL e DATABASE_URL_MIGRATIONS são necessárias. Para pular conscientemente, ' +
          'defina VEERTEX_SKIP_DB_TESTS=true.',
      );
    }

    owner = new Client({ connectionString: OWNER_URL });
    await owner.connect();

    // A APLICAÇÃO SOBE PRIMEIRO, e a ordem é obrigatória — não é preferência de organização.
    // O catálogo de módulos é semeado pelo bootstrap do boot (`module-catalog.seed.ts`), e as
    // fixtures abaixo inserem em `account_modules`, que tem FK para `modules(code)`. Criar as
    // fixtures antes de subir o app falha com
    // `violates foreign key constraint "account_modules_module_code_foreign"` — a tabela `modules`
    // ainda está vazia.
    //
    // O bootstrap apaga `DATABASE_URL_MIGRATIONS` de `process.env` ao terminar; por isso a conexão
    // de owner é aberta ACIMA, e a URL foi capturada na carga do módulo.
    // `createApplicationContext` e não `createNestApplication`: este teste não faz requisição HTTP,
    // e `createNestApplication` exigiria o `@nestjs/platform-express`, que não está instalado (o
    // projeto usa Fastify). O contexto de aplicação dispara `onApplicationBootstrap` — que é o que
    // importa aqui, porque é ele que semeia o catálogo de módulos.
    const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
    close = () => app.close();

    em = app.get(EntityManager);
    tenantContext = app.get(TenantContextService);
    toggleModule = app.get(ToggleModuleUseCase);
    getEffectiveModules = app.get(GetEffectiveModulesUseCase);
    listModules = app.get(ListModulesUseCase);
    tokens = app.get<TokenServicePort>(TOKEN_SERVICE);

    // Fixtures pelo OWNER: a conta não existe ainda, então não há escopo a estabelecer — mesma
    // razão pela qual o onboarding é CLI e não endpoint.
    await owner.query(
      `insert into plans (id, code, name, limits, active)
            values ($1, $2, 'Plano de ciclo de vida', $3::jsonb, true)`,
      [
        randomUUID(),
        planCode,
        JSON.stringify({ maxCompanies: null, maxUsers: null, modules: PLAN_MODULES }),
      ],
    );
    const plan = await owner.query('select id from plans where code = $1', [planCode]);

    await owner.query(
      `insert into accounts (id, name, document, plan_id, status, timezone)
            values ($1, 'Ciclo de vida', $2, $3, 'ACTIVE', 'America/Sao_Paulo')`,
      // CNPJ com dígitos verificadores válidos: a linha volta pelo mapper, que os confere.
      [accountId, makeValidCnpj(accountId.replace(/\D/g, '')), plan.rows[0].id],
    );
    await owner.query(
      `insert into roles (id, account_id, code, name, permissions, is_system)
            values ($1, $2, 'ADMIN', 'Administrador', '["*"]'::jsonb, true)`,
      [roleId, accountId],
    );
    await owner.query(
      `insert into users (id, account_id, name, email, phone, password_hash, role_id, status)
            values ($1, $2, 'Admin', $3, '+5562999990000', 'not-a-real-hash', $4, 'ACTIVE')`,
      [userId, accountId, `${userId}@lifecycle.local`, roleId],
    );
    // Todos os módulos do plano ligados, como o onboarding faria (exceto CORE, que é implícito).
    for (const code of PLAN_MODULES.filter((c) => c !== MODULES.CORE)) {
      await owner.query(
        `insert into account_modules (id, account_id, module_code, active, activated_at)
              values ($1, $2, $3, true, now())`,
        [randomUUID(), accountId, code],
      );
    }
  }, 120_000);

  afterAll(async () => {
    if (SKIP) {
      return;
    }
    await close?.();
    if (owner) {
      await owner.query('delete from account_modules where account_id = $1', [accountId]);
      await owner.query('delete from users where account_id = $1', [accountId]);
      await owner.query('delete from roles where account_id = $1', [accountId]);
      await owner.query('delete from accounts where id = $1', [accountId]);
      await owner.query('delete from plans where code = $1', [planCode]);
      await owner.end().catch(() => undefined);
    }
  });

  const maybe = SKIP ? it.skip : it;

  maybe('parte de um estado em que o módulo está ativo e liberado', async () => {
    const modules = await refreshedModules();

    expect(modules).toContain(MODULES.VND);
    expect(guardAllows(MODULES.VND, modules)).toBe(true);
  });

  maybe(
    'desativar → renovar → o token não traz mais o módulo, e o guard recusa (o 403 do §7.4)',
    async () => {
      // O token que os OUTROS usuários da conta já têm em mãos, emitido antes do toggle.
      const tokenBeforeToggle = await refreshedModules();
      expect(tokenBeforeToggle).toContain(MODULES.VND);

      const result = await asRequest(() =>
        toggleModule.execute(new ToggleModuleCommand(accountId, MODULES.VND, false)),
      );

      // O sinal que o frontend usa para renovar a sessão na hora, em vez de esperar 15 minutos.
      // É o que faz a janela ser ZERO para quem executou o toggle.
      expect(result.requiresTokenRefresh).toBe(true);
      expect(result.active).toBe(false);

      // A JANELA do §7.4, asseverada em vez de apenas tolerada: um token emitido antes do toggle
      // continua liberando o módulo. Não é defeito — é a consequência de os módulos viajarem no
      // JWT (ADR-0001), limitada pelo TTL do access token.
      expect(guardAllows(MODULES.VND, tokenBeforeToggle)).toBe(true);

      // Após a renovação, o 403.
      const modules = await refreshedModules();
      expect(modules).not.toContain(MODULES.VND);
      // É aqui que o 403 nasce. Enquanto não houver controller com @RequireModule, esta é a
      // asserção mais próxima do critério que se pode fazer sem inventar um endpoint.
      expect(guardAllows(MODULES.VND, modules)).toBe(false);
    },
  );

  maybe('o item sai do menu, mas o módulo continua disponível no plano', async () => {
    const listed = await asRequest(() => listModules.execute(new ListModulesQuery(accountId)));
    const vnd = listed.find((module) => module.code === MODULES.VND);

    expect(vnd?.active).toBe(false);
    // "Some do menu" é consequência de `active: false`; `availableInPlan` continua true, que é o
    // que permite religar sem falar com o comercial.
    expect(vnd?.availableInPlan).toBe(true);
  });

  maybe(
    'desativar preserva os dados: a linha permanece, com a trilha de quando saiu do ar',
    async () => {
      // Leitura pelo OWNER de propósito: prova que a linha EXISTE, e não apenas que o filtro da
      // aplicação a esconde. Se a desativação tivesse apagado, isto viria vazio.
      const rows = await owner.query(
        'select active, activated_at, deactivated_at from account_modules where account_id = $1 and module_code = $2',
        [accountId, MODULES.VND],
      );

      expect(rows.rows).toHaveLength(1);
      expect(rows.rows[0].active).toBe(false);
      expect(rows.rows[0].activated_at).not.toBeNull();
      expect(rows.rows[0].deactivated_at).not.toBeNull();
    },
  );

  maybe('reativar → renovar → restaura tudo', async () => {
    const result = await asRequest(() =>
      toggleModule.execute(new ToggleModuleCommand(accountId, MODULES.VND, true)),
    );
    expect(result.active).toBe(true);

    const modules = await refreshedModules();
    expect(modules).toContain(MODULES.VND);
    expect(guardAllows(MODULES.VND, modules)).toBe(true);

    // `deactivated_at` volta a nulo: a linha é a mesma, o histórico não virou uma segunda linha.
    const rows = await owner.query(
      'select active, deactivated_at from account_modules where account_id = $1 and module_code = $2',
      [accountId, MODULES.VND],
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].deactivated_at).toBeNull();
  });

  maybe('bloqueia desativar FIN com COB ativo, nomeando o dependente (B4.2)', async () => {
    await expect(
      asRequest(() => toggleModule.execute(new ToggleModuleCommand(accountId, MODULES.FIN, false))),
    ).rejects.toThrow(ModuleInUseByDependentsException);

    // A mensagem nomeia o dependente — é a decisão do §B4.2, não só o bloqueio.
    await expect(
      asRequest(() => toggleModule.execute(new ToggleModuleCommand(accountId, MODULES.FIN, false))),
    ).rejects.toThrow(new RegExp(MODULES.COB));
  });

  maybe('CORE não é desativável', async () => {
    await expect(
      asRequest(() =>
        toggleModule.execute(new ToggleModuleCommand(accountId, MODULES.CORE, false)),
      ),
    ).rejects.toThrow(CoreModuleNotToggleableException);
  });
});
