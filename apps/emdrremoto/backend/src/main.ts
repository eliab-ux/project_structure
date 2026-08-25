import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { IoAdapter } from '@nestjs/platform-socket.io';
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
    }),
  );

  // Never Trust Input: reject anything outside the DTO contract before it reaches a use case.
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Fail Securely: single point of exception handling; the ERROR_REPORTER is resolved from DI
  // so the fire-and-forget reporting is wired without hardcoding the implementation.
  app.useGlobalFilters(new GlobalExceptionFilter(app.get(ERROR_REPORTER)));

  // Real-time (Socket.IO) shares the SAME Fastify HTTP server / port as REST (single domain
  // on Dokploy). Gateways are added in Fase 5; registering the adapter now is harmless.
  app.useWebSocketAdapter(new IoAdapter(app));

  // CORS por CORS_ORIGIN (nunca "*" com credenciais em produção).
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()) ?? '*',
    credentials: true,
  });

  app.setGlobalPrefix('api');
  app.enableShutdownHooks();

  const port = process.env.PORT || 3005;
  const host = process.env.HOST || '0.0.0.0';

  await app.listen(port, host);

  // eslint-disable-next-line no-console
  console.log(`
    🧠 ${process.env.APP_NAME ?? 'EMDR Remoto'} is running!
    📝 Environment: ${process.env.NODE_ENV || 'development'}
    🌐 URL: ${await app.getUrl()}
    ❤️  Health: ${await app.getUrl()}/api/health
  `);
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('❌ Error starting application:', error);
  process.exit(1);
});
