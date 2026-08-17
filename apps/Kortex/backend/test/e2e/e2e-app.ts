import { config as loadEnv } from 'dotenv';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
// Do core, e não de `@mikro-orm/postgresql`: é sob o token do core que o MikroOrmModule registra
// a instância, e pedir pelo tipo do driver faz o TypeScript esperar um EM que o container não deu.
import { MikroORM, RequestContext } from '@mikro-orm/core';

/**
 * Sobe a aplicação REAL contra o banco de teste.
 *
 * O `DATABASE_URL` é trocado ANTES de qualquer import do AppModule, e por isso os imports abaixo
 * são dinâmicos: o `ConfigModule` lê `process.env` no momento em que o módulo é avaliado, e um
 * import estático no topo do arquivo já teria fixado a URL de desenvolvimento — o teste apagaria
 * a tabela de trabalho.
 */
loadEnv({ override: false });

const TEST_DATABASE_URL = process.env.DATABASE_URL_TEST;
if (!TEST_DATABASE_URL) {
  throw new Error(
    'DATABASE_URL_TEST não configurada. Suba o banco local ' +
      '(docker compose -f apps/Kortex/docker-compose.yml up -d) e confira o .env.',
  );
}
process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.NODE_ENV = 'test';

// Segredos determinísticos para o teste, e só para ele — nunca reaproveitados fora daqui.
process.env.JWT_ACCESS_SECRET ??= 'e2e-access-secret-com-tamanho-suficiente-000000';
process.env.JWT_REFRESH_SECRET ??= 'e2e-refresh-secret-com-tamanho-suficiente-11111';

export interface E2EContext {
  app: NestFastifyApplication;
  orm: MikroORM;
  inject: (options: {
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    url: string;
    token?: string;
    payload?: unknown;
    // O corpo é `any` porque cada teste conhece o formato da própria resposta e afirma sobre ele.
    // A alternativa — um genérico por chamada — encheria os testes de tipos que já estão provados
    // pelos DTOs do backend, e o que se lê aqui é a afirmação, não a tipagem.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) => Promise<{ statusCode: number; body: any }>;
  /**
   * Roda código que usa repositórios fora de uma requisição HTTP (o seed, por exemplo).
   *
   * O MikroORM proíbe usar o EntityManager global diretamente, e com razão: é o fork por
   * requisição que impede o identity map de uma conta de vazar para outra sob concorrência. Numa
   * requisição de verdade quem cria esse contexto é o `registerRequestContext` do
   * PersistenceModule; aqui o teste precisa criá-lo à mão.
   */
  runInContext: <T>(work: () => Promise<T>) => Promise<T>;
}

export interface E2EOptions {
  /** Substitui providers por dublês — usado para não disparar WhatsApp de verdade no teste. */
  overrides?: { token: unknown; useValue: unknown }[];
}

export async function createE2EApp(options: E2EOptions = {}): Promise<E2EContext> {
  const { AppModule } = await import('../../src/app.module');
  const { configureApp } = await import('../../src/bootstrap');
  const { Test } = await import('@nestjs/testing');

  let builder = Test.createTestingModule({ imports: [AppModule] });
  for (const override of options.overrides ?? []) {
    builder = builder.overrideProvider(override.token).useValue(override.useValue);
  }

  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter({ logger: false }),
    { logger: false },
  );

  // A MESMA configuração da produção — pipe, filtro, prefixo. Ver o docblock de `configureApp`.
  configureApp(app);

  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  const orm = app.get(MikroORM);

  /**
   * Schema do zero a cada suíte, pela raiz: `drop schema public cascade`.
   *
   * E não o `dropSchema()` do SchemaGenerator, que derruba só as tabelas das entidades mapeadas —
   * deixaria de pé o `mikro_orm_migrations` e o tipo `timerange`, e aí o migrator veria as
   * migrations como já aplicadas e não recriaria tabela nenhuma. A suíte rodaria contra um banco
   * vazio achando que estava pronto.
   *
   * É destrutivo de propósito, e é seguro porque aponta para `kortex_test`, um banco separado
   * exatamente para isto (ver deploy/local/init-test-db.sql).
   */
  const connection = orm.em.getConnection();
  await connection.execute('drop schema if exists public cascade;');
  await connection.execute('create schema public;');
  await orm.getMigrator().up();

  const inject: E2EContext['inject'] = async ({ method, url, token, payload }) => {
    const response = await app
      .getHttpAdapter()
      .getInstance()
      .inject({
        method,
        url,
        headers: token ? { authorization: `Bearer ${token}` } : {},
        payload: payload as never,
      });

    let body: unknown = null;
    if (response.body) {
      try {
        body = JSON.parse(response.body);
      } catch {
        body = response.body;
      }
    }
    return { statusCode: response.statusCode, body };
  };

  const runInContext = <T>(work: () => Promise<T>): Promise<T> =>
    RequestContext.create(orm.em, work);

  return { app, orm, inject, runInContext };
}
