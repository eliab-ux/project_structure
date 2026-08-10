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
      // Behind Traefik on the mdantas server, so the client IP has to come from the forwarded
      // headers — without this every audit line would record the proxy's address.
      trustProxy: true,
      // Uploads arrive as base64 in JSON (Fastify — never multer/multipart, see CLAUDE.md). No
      // upload endpoint exists in F1; the limit is set now so the first one does not need a
      // bootstrap change.
      bodyLimit: 25 * 1024 * 1024,
    }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      // `whitelist` strips unknown properties; `forbidNonWhitelisted` rejects the request outright.
      // Together they are what guarantees no DTO can smuggle an `accountId` past the tenant scope.
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // The filter resolves ERROR_REPORTER from the container, so fire-and-forget reporting is wired
  // without hardcoding the implementation.
  app.useGlobalFilters(new GlobalExceptionFilter(app.get(ERROR_REPORTER)));

  // In production CORS_ORIGIN must list the real frontend origins — never '*' with credentials.
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',').map((origin) => origin.trim()) ?? '*',
    credentials: true,
  });

  app.setGlobalPrefix('api');
  app.enableShutdownHooks();

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
