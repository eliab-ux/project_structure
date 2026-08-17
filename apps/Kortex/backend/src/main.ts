import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: true,
      trustProxy: true,
    }),
  );

  configureApp(app);
  app.enableShutdownHooks();

  const port = process.env.PORT ?? 3030;
  const host = process.env.HOST ?? '0.0.0.0';

  await app.listen(port, host);

  // eslint-disable-next-line no-console
  console.log(`
    ✂️  ${process.env.KORTEX_APP_NAME ?? 'Kortex'} is running!
    📝 Environment: ${process.env.NODE_ENV ?? 'development'}
    🌐 URL: ${await app.getUrl()}
  `);
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('❌ Error starting application:', error);
  process.exit(1);
});
