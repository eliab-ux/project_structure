import { createApp } from './create-app';

/**
 * Ponto de entrada do servidor. Toda a configuração (pipes, filtros, CORS, prefixo) mora em
 * `create-app.ts`, compartilhada com o teste de execução — ver o docblock de lá para o motivo.
 * Aqui fica só o que é exclusivo de subir de verdade: porta, host e o aviso ao operador.
 */
async function bootstrap() {
  const app = await createApp();

  const port = process.env.PORT ?? 3020;
  const host = process.env.HOST ?? '0.0.0.0';

  await app.listen(port, host);

  // eslint-disable-next-line no-console
  console.log(`
    ▲ ${process.env.VEERTEX_APP_NAME ?? 'Veertex'} is running!
    📝 Environment: ${process.env.NODE_ENV ?? 'development'}
    🌐 URL: ${await app.getUrl()}
  `);
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('❌ Error starting application:', error);
  process.exit(1);
});
