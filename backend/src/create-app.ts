import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './infrastructure/http/filters/global-exception.filter';
import { ERROR_REPORTER } from './infrastructure/observability/ports/error-reporter.port';

/**
 * Constrói a aplicação HTTP já configurada — o MESMO objeto que o `main.ts` põe no ar.
 *
 * **Por que isto não vive no `main.ts`.** O teste de execução do `smoke:auth` precisa de um servidor
 * de verdade para bater. Se ele subisse o `AppModule` por conta própria, subiria um app SEM prefixo
 * `/api`, sem `ValidationPipe` e sem `GlobalExceptionFilter` — e então:
 *
 *   - toda rota responderia 404, porque o smoke chama `/api/auth/login`;
 *   - as asserções sobre validação e sobre erro genérico testariam um app que ninguém opera.
 *
 * O risco pior não é o teste falhar, é ele PASSAR contra uma configuração diferente da real. Um
 * `ValidationPipe` com `whitelist` removido do `main.ts` deixaria a suíte verde, porque o app do
 * teste nunca teve o pipe para começar. Uma função só, usada pelos dois, elimina a possibilidade.
 *
 * A alternativa descartada foi duplicar a configuração no helper de teste: mais curta de escrever e
 * silenciosamente errada no primeiro dia em que o `main.ts` mudasse.
 */
export async function createApp(): Promise<NestFastifyApplication> {
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

  return app;
}
