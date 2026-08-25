import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './infrastructure/http/filters/global-exception.filter';
import { ERROR_REPORTER } from './infrastructure/observability/ports/error-reporter.port';
import { runPendingMigrations } from './infrastructure/persistence/mikro-orm/run-pending-migrations';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: true,
      trustProxy: true,
      bodyLimit: 1 * 1024 * 1024,
    }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // O GlobalExceptionFilter resolve o ERROR_REPORTER pelo container de DI — o reporte
  // fire-and-forget fica plugado sem hardcodar a implementação.
  app.useGlobalFilters(new GlobalExceptionFilter(app.get(ERROR_REPORTER)));

  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()) ?? '*',
    credentials: true,
  });

  app.setGlobalPrefix('api');
  app.enableShutdownHooks();

  // Antes de aceitar tráfego: o schema precisa estar na última versão.
  await runPendingMigrations(app);

  const port = process.env.PORT || 3011;
  const host = process.env.HOST || '0.0.0.0';

  await app.listen(port, host);

  // eslint-disable-next-line no-console
  console.log(`
    📖 ${process.env.APP_NAME ?? 'Plano Diário'} is running!
    📝 Environment: ${process.env.NODE_ENV || 'development'}
    🌐 URL: ${await app.getUrl()}
  `);
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('❌ Error starting application:', error);
  process.exit(1);
});
