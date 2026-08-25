import { IsString, IsNumber, IsOptional, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

/**
 * Env contract. Secrets/integrations are @IsOptional so the skeleton boots without them
 * (Fase 0). Each one is enforced where it is actually used (mikro-orm.config, token service,
 * external adapters) — Fail Securely: a missing secret throws at the boundary that needs it,
 * never silently degrades.
 */
export class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  PORT = 3005;

  @IsString()
  @IsOptional()
  APP_NAME = 'EMDR Remoto';

  @IsString()
  @IsOptional()
  CORS_ORIGIN?: string;

  // URL pública do frontend usada nos LINKS enviados (convite, verificação). Em produção,
  // o domínio real (https://...) — necessário para o WhatsApp transformar em link clicável.
  @IsString()
  @IsOptional()
  APP_PUBLIC_URL?: string;

  // --- Banco (MySQL) ---
  @IsString()
  @IsOptional()
  DATABASE_URL?: string;

  // --- Auth (JWT próprio) ---
  @IsString()
  @IsOptional()
  JWT_ACCESS_SECRET?: string;

  @IsString()
  @IsOptional()
  JWT_REFRESH_SECRET?: string;

  @IsString()
  @IsOptional()
  JWT_ACCESS_EXPIRATION = '15m';

  @IsString()
  @IsOptional()
  JWT_REFRESH_EXPIRATION = '7d';

  // --- Integrações externas ---
  @IsString()
  @IsOptional()
  DAILY_CO_API_KEY?: string;

  @IsString()
  @IsOptional()
  TWILIO_ACCOUNT_SID?: string;

  @IsString()
  @IsOptional()
  TWILIO_AUTH_TOKEN?: string;

  @IsString()
  @IsOptional()
  TWILIO_FROM_NUMBER?: string;

  @IsString()
  @IsOptional()
  SMTP_HOST?: string;

  @IsString()
  @IsOptional()
  SMTP_USER?: string;

  @IsString()
  @IsOptional()
  SMTP_PASSWORD?: string;

  @IsString()
  @IsOptional()
  SMTP_FROM?: string;

  // --- WhatsApp (Evolution API) ---
  @IsString()
  @IsOptional()
  EVOLUTION_API_URL?: string;

  // Chave GLOBAL do Evolution (necessária só para criar instâncias próprias).
  @IsString()
  @IsOptional()
  EVOLUTION_API_KEY?: string;

  // Instância compartilhada existente (ex.: "emdr") + sua apikey.
  @IsString()
  @IsOptional()
  EVOLUTION_SHARED_INSTANCE?: string;

  @IsString()
  @IsOptional()
  EVOLUTION_SHARED_APIKEY?: string;

  // --- Observabilidade ---
  @IsString()
  @IsOptional()
  ERROR_REPORTER_URL?: string;

  @IsString()
  @IsOptional()
  ERROR_REPORTER_API_KEY?: string;
}

export function validate(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(errors.toString());
  }
  return validated;
}
