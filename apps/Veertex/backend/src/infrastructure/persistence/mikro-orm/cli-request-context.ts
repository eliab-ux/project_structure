import { INestApplicationContext } from '@nestjs/common';
import { MikroORM, RequestContext } from '@mikro-orm/core';

/**
 * Roda um trecho de código dentro de um `RequestContext` do MikroORM — o que uma CLI precisa fazer
 * para poder executar um Use Case.
 *
 * **Por que existe.** Em requisição HTTP, o `@mikro-orm/nestjs` embrulha cada request num
 * `RequestContext` (`registerRequestContext: true`, em `persistence.module.ts`), e é ele que FORKA o
 * EntityManager: cada request ganha o seu, com identity map próprio. Um `NestFactory
 * .createApplicationContext()` não tem requisição nenhuma, então nada forka nada — e o `em` injetado
 * nos repositórios resolve para a instância GLOBAL. Na primeira operação, o MikroORM recusa:
 *
 *     Using global EntityManager instance methods for context specific actions is disallowed.
 *
 * A recusa é uma proteção, não um capricho: sem fork, dois comandos concorrentes compartilhariam
 * identity map e unit of work — e um `flush()` de um escreveria as entidades pendentes do outro.
 *
 * **Por que não `allowGlobalContext: true`.** É a saída que o próprio erro sugere, e ela desliga a
 * proteção para a aplicação INTEIRA, inclusive para os requests HTTP, para resolver um problema que
 * é só das CLIs. Forkar no ponto certo custa uma linha e não abre mão de nada.
 *
 * **Por que não `orm.em.fork()` direto.** O fork resolveria para quem chamasse `orm.em.fork()` e
 * usasse o resultado — mas os repositórios recebem o `em` por injeção, e não teriam como saber do
 * fork. `RequestContext.create` publica o fork no async local storage, que é exatamente onde o `em`
 * injetado vai procurar. O código do Use Case fica idêntico ao que roda sob HTTP.
 */
export async function runInRequestContext<T>(
  app: INestApplicationContext,
  work: () => Promise<T>,
): Promise<T> {
  const orm = app.get(MikroORM);
  return RequestContext.create(orm.em, work);
}
