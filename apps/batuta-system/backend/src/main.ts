import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './infrastructure/http/filters/global-exception.filter';
import { ERROR_REPORTER } from './infrastructure/observability/ports/error-reporter.port';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: true,
      trustProxy: true,
      // Media arrives as base64 in JSON (Fastify — never multer/multipart, see CLAUDE.md),
      // so the body limit has to cover the largest allowed asset plus base64 overhead.
      bodyLimit: 25 * 1024 * 1024,
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

  // The filter resolves ERROR_REPORTER from the container, so the fire-and-forget reporting
  // is wired without hardcoding the implementation.
  app.useGlobalFilters(new GlobalExceptionFilter(app.get(ERROR_REPORTER)));

  // In production CORS_ORIGIN must list the real frontend origins — never '*' with credentials.
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',').map((origin) => origin.trim()) ?? '*',
    credentials: true,
  });

  app.setGlobalPrefix('api');
  app.enableShutdownHooks();

  const port = process.env.PORT ?? 3010;
  const host = process.env.HOST ?? '0.0.0.0';

  await app.listen(port, host);

  // eslint-disable-next-line no-console
  console.log(`
    🎼 ${process.env.BATUTA_APP_NAME ?? 'Batuta'} is running!
    📝 Environment: ${process.env.NODE_ENV ?? 'development'}
    🌐 URL: ${await app.getUrl()}
  `);
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('❌ Error starting application:', error);
  process.exit(1);
});
