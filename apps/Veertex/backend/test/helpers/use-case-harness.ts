import { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { EntityManager, MikroORM, RequestContext } from '@mikro-orm/core';
import { AppModule } from '../../src/app.module';
import { TenantContextService } from '../../src/infrastructure/security/tenant-context.service';

/**
 * Executa Use Cases nas MESMAS condições de uma requisição HTTP — e essa igualdade é o ponto.
 *
 * Uma requisição real passa por três coisas antes de chegar ao Use Case:
 *
 *   1. `RequestContext` forka o EntityManager (`registerRequestContext`);
 *   2. `JwtAuthGuard` chama `TenantContextService.establish(accountId)` com o id vindo do token;
 *   3. `TenantTransactionInterceptor` abre uma transação, e é o `TenantScopeSubscriber` que a
 *      transforma em `set_config('app.account_id', …, true)`.
 *
 * Faltando qualquer um dos três, o teste mede outra coisa. Sem o (1), o MikroORM recusa o EM global.
 * Sem o (2), o filtro global lança. Sem o (3) — o mais traiçoeiro — o GUC nunca é escrito, as
 * policies não veem tenant, e TODA leitura devolve zero linhas: o teste falha com cara de bug de
 * dados quando o que houve foi falta de escopo.
 *
 * A alternativa descartada foi conectar como `veertex_owner` no teste, o que faria tudo passar sem
 * transação nenhuma. Passaria porque o dono ignora as policies — isto é, o teste ficaria verde
 * exatamente na configuração em que o isolamento não existe. Aqui se conecta como `veertex_app`,
 * o papel de runtime, com RLS valendo.
 */
export interface UseCaseHarness {
  app: INestApplicationContext;
  /** Uma "requisição" de uma conta: escopo estabelecido e transação aberta. */
  asAccount<T>(accountId: string, work: () => Promise<T>): Promise<T>;
  /** Uma "requisição" sem escopo — o que login e reset de senha enfrentam antes de identificar. */
  unscoped<T>(work: () => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export async function createUseCaseHarness(): Promise<UseCaseHarness> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const orm = app.get(MikroORM);

  const run = async <T>(accountId: string | null, work: () => Promise<T>): Promise<T> =>
    RequestContext.create(orm.em, async () => {
      if (accountId !== null) {
        app.get(TenantContextService).establish(accountId);
      }
      // O `em` do container é o proxy que resolve para o fork do contexto — o mesmo que os
      // repositórios recebem por injeção.
      return app.get(EntityManager).transactional(async () => work());
    });

  return {
    app,
    asAccount: (accountId, work) => run(accountId, work),
    unscoped: (work) => run(null, work),
    close: () => app.close(),
  };
}
