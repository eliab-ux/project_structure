/**
 * Módulo de efeito colateral: aponta o canal de WhatsApp para o Evolution de mentira.
 *
 * **Precisa ser o PRIMEIRO import do spec**, e o motivo é o mesmo do `cli-owner-connection.ts`: os
 * `import` são içados e executados antes de qualquer código do arquivo, de modo que o `AppModule`
 * — e com ele o `ConfigModule.forRoot()` — já teria lido o ambiente quando um `beforeAll` fosse
 * rodar. Definir as variáveis lá dentro não chega ao `ConfigService`, e o adapter recusa o envio
 * dizendo que o canal não está configurado. Foi exatamente o que aconteceu na primeira execução
 * deste teste: doze falhas, todas com `RecoveryChannelUnavailableException`.
 *
 * A porta é FIXA porque a ordem exige conhecer a URL antes de o servidor existir — uma porta
 * efêmera só é conhecida depois do `listen`, tarde demais. `startFakeEvolution` falha com mensagem
 * clara se ela estiver ocupada.
 */
export const FAKE_EVOLUTION_PORT = 39_517;
export const FAKE_EVOLUTION_INSTANCE = 'veertex-sistema-teste';
export const FAKE_EVOLUTION_APIKEY = 'apikey-DA-INSTANCIA-de-teste';

process.env.EVOLUTION_API_URL = `http://127.0.0.1:${FAKE_EVOLUTION_PORT}`;
process.env.EVOLUTION_SYSTEM_INSTANCE = FAKE_EVOLUTION_INSTANCE;
process.env.EVOLUTION_SYSTEM_APIKEY = FAKE_EVOLUTION_APIKEY;
