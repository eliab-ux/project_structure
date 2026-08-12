/**
 * Módulo de efeito colateral: encurta a escada do throttle de login para a suíte.
 *
 * **Precisa ser o PRIMEIRO import do spec** — mesmo motivo do `cli-owner-connection.ts` e do
 * `evolution-test-env.ts`: os `import` são içados, o `AppModule` carrega o `ConfigModule.forRoot()`
 * junto, e uma variável definida num `beforeAll` chega tarde.
 *
 * Os valores de produção (1s → 8s, teto de 50 falhas por IP) tornariam este spec um teste de sete
 * segundos por asserção. Encurtar não enfraquece o que se verifica: o que importa é a FORMA da
 * escada (dobra a cada falha, para no teto) e a EQUIVALÊNCIA de tempo entre conta existente e
 * inexistente — as duas invariantes valem em qualquer escala.
 *
 * `BASE` é grande de propósito — 800ms, e não 20ms nem 300ms. O atraso precisa DOMINAR o ruído, e o
 * ruído aqui é considerável: a comparação bcrypt do login usa custo 12 e leva centenas de
 * milissegundos, variando com a carga da máquina. Com 300ms, uma rodada da suíte completa (em que
 * outras suítes acabaram de disputar CPU) fez uma tentativa SEM atraso levar 326ms acima do piso e
 * reprovar por 26ms — sem defeito nenhum no produto.
 *
 * Um teste frágil é pior do que teste ausente: ele ensina a reexecutar até passar, e a partir daí
 * ninguém olha o que ele diz. Alargar a tolerância teria escondido o problema oposto — um atraso que
 * deixasse de ser aplicado passaria dentro da folga. Aumentar o sinal preserva as duas direções.
 *
 * Chegou a 1600ms depois de 800 ainda reprovar por 25ms: cada medição carrega ~200ms de variação, e
 * toda asserção compara DUAS medições, então o ruído da diferença chega a ~300ms. Com sinal de
 * 1600ms e tolerância de metade, sobra margem de sobra em ambas as direções — e a asserção continua
 * reprovando de verdade se o atraso desaparecer, porque aí a diferença cai para perto de zero.
 */
export const THROTTLE_BASE_MS = 1600;
export const THROTTLE_MAX_MS = 3200;
export const THROTTLE_IP_LIMIT = 4;

process.env.LOGIN_DELAY_BASE_MS = String(THROTTLE_BASE_MS);
process.env.LOGIN_DELAY_MAX_MS = String(THROTTLE_MAX_MS);
process.env.LOGIN_IP_FAILURE_LIMIT = String(THROTTLE_IP_LIMIT);
process.env.LOGIN_IP_WINDOW_MS = String(60_000);
process.env.LOGIN_DELAY_RESET_MS = String(60_000);
