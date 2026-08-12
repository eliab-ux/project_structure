/**
 * Módulo de efeito colateral: escolhe o tradutor DETERMINÍSTICO para a suíte.
 *
 * **Precisa ser o PRIMEIRO import do spec** — os `import` são içados e o `AppModule` carrega o
 * `ConfigModule.forRoot()` junto, então definir a variável num `beforeAll` chega tarde. Mesmo padrão
 * do `evolution-test-env.ts` e do `login-throttle-test-env.ts`.
 *
 * Sem isto, todo teste da Mesa dependeria de chamada externa paga e não determinística — e teste que
 * não se pode rodar é teste que se aprende a ignorar (condição registrada por Eliab em 12/08/2026).
 */
process.env.INTENT_PARSER_DRIVER = 'deterministic';
