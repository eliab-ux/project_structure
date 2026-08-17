import { ValidationPipe } from '@nestjs/common';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { GlobalExceptionFilter } from './infrastructure/http/filters/global-exception.filter';
import { ERROR_REPORTER } from './infrastructure/observability/ports/error-reporter.port';

/**
 * Toda a configuração do app que não é "subir o servidor": pipe de validação, filtro global,
 * CORS e prefixo.
 *
 * Vive separada do `main.ts` para que os testes e2e montem a aplicação EXATAMENTE como produção.
 * Se cada um configurasse o seu, o teste passaria com um `ValidationPipe` diferente do real — e a
 * primeira coisa a divergir seria `forbidNonWhitelisted`, que é justamente o que impede um campo
 * a mais de entrar num DTO.
 */
export function configureApp(app: NestFastifyApplication): void {
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // O filtro resolve ERROR_REPORTER pelo container, então o report fire-and-forget fica ligado
  // sem a implementação estar hardcodada.
  app.useGlobalFilters(new GlobalExceptionFilter(app.get(ERROR_REPORTER)));

  // Em produção, CORS_ORIGIN deve listar as origens reais do frontend — nunca '*' com credentials.
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',').map((origin) => origin.trim()) ?? '*',
    credentials: true,
  });

  app.setGlobalPrefix('api');
}
