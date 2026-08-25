import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

/**
 * Variáveis de ambiente validadas no boot. Secrets são opcionais aqui para o app subir em
 * desenvolvimento com placeholders; os serviços que dependem deles falham rápido ao serem usados
 * (ex.: JwtTokenService exige JWT_ACCESS_SECRET). Nenhum secret tem valor default no código.
 */
export class EnvironmentVariables {
  @IsString()
  @IsOptional()
  APP_NAME: string = 'Plano Diário';

  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @Transform(({ value }) => (value ? parseInt(value as string, 10) : 3011))
  @IsOptional()
  PORT: number = 3011;

  @IsString()
  @IsOptional()
  HOST: string = '0.0.0.0';

  // ==== Banco ====
  @IsString()
  DATABASE_URL!: string;

  /** `false` desliga a aplicação automática de migrations no start. Default: ligado. */
  @IsString()
  @IsOptional()
  MIGRATIONS_ON_BOOT: string = 'true';

  // ==== Redis (BullMQ — usado a partir da Fase 6) ====
  @IsString()
  @IsOptional()
  REDIS_HOST: string = 'localhost';

  @IsNumber()
  @Transform(({ value }) => (value ? parseInt(value as string, 10) : 6379))
  @IsOptional()
  REDIS_PORT: number = 6379;

  @IsString()
  @IsOptional()
  REDIS_USERNAME?: string;

  @IsString()
  @IsOptional()
  REDIS_PASSWORD?: string;

  /** Prefixo das chaves do BullMQ — isola as filas caso o Redis seja compartilhado. */
  @IsString()
  @IsOptional()
  REDIS_PREFIX: string = 'plano-diario';

  /** `false` desliga o envio automático mesmo com Redis configurado. */
  @IsString()
  @IsOptional()
  DISPATCH_ENABLED: string = 'true';

  // ==== Auth (JWT próprio — Fase 1) ====
  @IsString()
  @IsOptional()
  JWT_ACCESS_SECRET?: string;

  @IsString()
  @IsOptional()
  JWT_REFRESH_SECRET?: string;

  @IsString()
  @IsOptional()
  JWT_ACCESS_EXPIRATION: string = '15m';

  @IsString()
  @IsOptional()
  JWT_REFRESH_EXPIRATION: string = '7d';

  // ==== YouTube (Fase 2) ====
  @IsString()
  @IsOptional()
  YOUTUBE_API_KEY?: string;

  @IsString()
  @IsOptional()
  YOUTUBE_CHANNEL_HANDLE: string = 'caminhandocomharoldwalker';

  // ==== Plano de leitura (conferido com o usuário em 28/07/2026) ====
  /**
   * Dia 1 do plano (`yyyy-MM-dd`). Com `2026-01-01` e as 365 leituras, a última
   * ("Dia 365 - Apocalipse 20-22") cai em 31/12/2026 e todas as demais âncoras conferidas com
   * o usuário batem — ver `.env.example` para a lista.
   */
  @IsString()
  @IsOptional()
  PLAN_START_DATE: string = '2026-01-01';

  @IsNumber()
  @Transform(({ value }) => (value ? parseInt(value as string, 10) : 0))
  @IsOptional()
  PLAN_DAY_OFFSET: number = 0;

  // ==== Evolution API (Fase 3) ====
  @IsString()
  @IsOptional()
  EVOLUTION_API_URL?: string;

  @IsString()
  @IsOptional()
  EVOLUTION_API_KEY?: string;

  @IsString()
  @IsOptional()
  EVOLUTION_WEBHOOK_TOKEN?: string;

  /** 32 bytes em hex (64 chars) — AES-256-GCM do instance_token. */
  @IsString()
  @IsOptional()
  ENCRYPTION_KEY?: string;

  // ==== Agendamento / envio (Fase 6) ====
  @IsString()
  @IsOptional()
  DEFAULT_TIMEZONE: string = 'America/Sao_Paulo';

  @IsString()
  @IsOptional()
  CATALOG_SYNC_CRON: string = '0 3 * * *';

  @IsNumber()
  @Transform(({ value }) => (value ? parseInt(value as string, 10) : 3))
  @IsOptional()
  DISPATCH_CATCHUP_WINDOW_HOURS: number = 3;

  // ==== CORS / frontend ====
  @IsString()
  @IsOptional()
  CORS_ORIGIN?: string;

  @IsString()
  @IsOptional()
  FRONTEND_URL: string = 'http://localhost:3013';

  // ==== Error reporter (vazio = no-op) ====
  @IsString()
  @IsOptional()
  ERROR_REPORTER_URL?: string;

  @IsString()
  @IsOptional()
  ERROR_REPORTER_API_KEY?: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = new EnvironmentVariables();
  Object.assign(validatedConfig, config);
  return validatedConfig;
}
