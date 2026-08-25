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
      bodyLimit: 5 * 1024 * 1024,
    }),
    // The Instagram webhook signature (X-Hub-Signature-256) is an HMAC of the RAW body,
    // so we keep the raw buffer (req.rawBody) to verify it before trusting the payload.
    { rawBody: true },
  );

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // GlobalExceptionFilter resolves the ERROR_REPORTER from the DI container so the
  // fire-and-forget reporting is wired without hardcoding the implementation.
  app.useGlobalFilters(new GlobalExceptionFilter(app.get(ERROR_REPORTER)));

  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()) ?? '*',
    credentials: true,
  });

  app.setGlobalPrefix('api');
  app.enableShutdownHooks();

  const port = process.env.PORT || 3001;
  const host = process.env.HOST || '0.0.0.0';

  await app.listen(port, host);

  // eslint-disable-next-line no-console
  console.log(`
    🌱 ${process.env.APP_NAME ?? 'Ecoa'} is running!
    📝 Environment: ${process.env.NODE_ENV || 'development'}
    🌐 URL: ${await app.getUrl()}
  `);
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('❌ Error starting application:', error);
  process.exit(1);
});
