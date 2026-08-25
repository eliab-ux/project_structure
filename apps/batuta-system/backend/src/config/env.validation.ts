import { Transform, plainToInstance } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  validateSync,
} from 'class-validator';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

/** parseInt that keeps the class default when the variable is absent or blank. */
function toInt(fallback: number) {
  return ({ value }: { value: unknown }): number => {
    if (value === undefined || value === null || value === '') {
      return fallback;
    }
    const parsed = Number.parseInt(String(value), 10);
    return Number.isNaN(parsed) ? Number.NaN : parsed;
  };
}

/** Accepts the usual textual booleans coming from a .env file. */
function toBoolean(fallback: boolean) {
  return ({ value }: { value: unknown }): boolean => {
    if (value === undefined || value === null || value === '') {
      return fallback;
    }
    if (typeof value === 'boolean') {
      return value;
    }
    return ['true', '1', 'yes', 'on'].includes(String(value).trim().toLowerCase());
  };
}

/**
 * Validated environment variables — fail fast at startup (FASE 0, item 3).
 *
 * What is REQUIRED here is only what the app needs to boot at all (DATABASE_URL).
 * Integration secrets (Evolution, MinIO, SMTP) are optional at boot and validated by the
 * adapter that consumes them, so a partially configured environment still starts and
 * reports a precise error at the point of use instead of a vague boot failure.
 *
 * Never add a variable here without also adding it to `.env.example` (CLAUDE.md).
 */
export class EnvironmentVariables {
  // ==== Aplicação ====
  @IsString()
  @IsOptional()
  BATUTA_APP_NAME: string = 'Batuta';

  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsInt()
  @Min(1)
  @Max(65535)
  @Transform(toInt(3010))
  @IsOptional()
  PORT: number = 3010;

  @IsString()
  @IsOptional()
  HOST: string = '0.0.0.0';

  // ==== Banco ====
  @IsString()
  DATABASE_URL!: string;

  // ==== Redis / BullMQ ====
  @IsString()
  @IsOptional()
  REDIS_HOST: string = 'localhost';

  @IsInt()
  @Min(1)
  @Max(65535)
  @Transform(toInt(6379))
  @IsOptional()
  REDIS_PORT: number = 6379;

  @IsString()
  @IsOptional()
  REDIS_USERNAME?: string;

  @IsString()
  @IsOptional()
  REDIS_PASSWORD?: string;

  // ==== Auth (JWT próprio) ====
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

  // ==== Aprovação (magic link) ====
  @IsInt()
  @Min(1)
  @Transform(toInt(72))
  @IsOptional()
  APPROVAL_TOKEN_TTL_HOURS: number = 72;

  // ==== Distribuição / agendamento (FASE 6) ====
  // Limites e não valores exatos: cada um é DECISÃO PENDENTE (§14 itens 4, 5, 6) e o que a validação
  // garante é que nenhum deles chegue como algo que quebraria o agendador — 0% de reserva, intervalo
  // negativo, ou uma janela de silêncio invertida.
  @IsInt()
  @Min(5)
  @Max(80)
  @Transform(toInt(20))
  @IsOptional()
  DISTRIBUTION_REPLY_RESERVE_PERCENT: number = 20;

  @IsInt()
  @Min(1)
  @Transform(toInt(45))
  @IsOptional()
  DISPATCH_MIN_INTERVAL_SECONDS: number = 45;

  @IsInt()
  @Min(1)
  @Transform(toInt(120))
  @IsOptional()
  DISPATCH_MAX_INTERVAL_SECONDS: number = 120;

  @IsInt()
  @Min(1)
  @Transform(toInt(30))
  @IsOptional()
  DISPATCH_MAX_PER_HOUR: number = 30;

  @IsInt()
  @Min(0)
  @Max(23)
  @Transform(toInt(8))
  @IsOptional()
  QUIET_HOURS_START: number = 8;

  @IsInt()
  @Min(1)
  @Max(23)
  @Transform(toInt(21))
  @IsOptional()
  QUIET_HOURS_END: number = 21;

  // DEFAULT_TIMEZONE já é declarado abaixo, junto do cron do throttle (FASE 2): o agendador reusa a
  // mesma env em vez de introduzir uma segunda fonte de verdade para "que dia é hoje".

  // ==== Caixa de entrada (FASE 8) ====
  // DECISÃO PENDENTE §14 item 12 no TTL. Os limites existem contra o erro de digitação que trava um
  // contato por um dia (valor alto) ou entrega o mesmo item a dois operadores (valor baixo).
  @IsInt()
  @Min(1)
  @Max(240)
  @Transform(toInt(15))
  @IsOptional()
  INBOX_LOCK_TTL_MINUTES: number = 15;

  @IsInt()
  @Min(10)
  @Max(2000)
  @Transform(toInt(200))
  @IsOptional()
  INBOX_HISTORY_LIMIT: number = 200;

  @IsInt()
  @Min(30)
  @Transform(toInt(600))
  @IsOptional()
  INBOX_MEDIA_URL_TTL_SECONDS: number = 600;

  // ==== Reset de senha ====
  // O TTL do CÓDIGO não é variável de ambiente: 15 minutos vive em RESET_CODE_TTL_MINUTES, na
  // entidade de domínio, porque é regra de negócio — o canal é instantâneo e um código que vale uma
  // hora só amplia a janela de quem o interceptou. Não há o que ajustar por ambiente.

  // ==== Evolution API (WhatsApp) ====
  @IsString()
  @IsOptional()
  EVOLUTION_API_URL?: string;

  @IsString()
  @IsOptional()
  EVOLUTION_API_KEY?: string;

  @IsString()
  @IsOptional()
  EVOLUTION_WEBHOOK_TOKEN?: string;

  /**
   * Instância dedicada da PLATAFORMA — avisos de aprovação e o código de recuperação de senha.
   * NUNCA um chip de tenant: chip de campanha cai, canal de recuperação não pode cair com ele.
   */
  @IsString()
  @IsOptional()
  EVOLUTION_SYSTEM_INSTANCE?: string;

  /**
   * Apikey DA INSTÂNCIA de sistema. Preferida sobre `EVOLUTION_API_KEY` por menor privilégio:
   * enviar mensagem não precisa de poder para criar ou apagar instância. Ausente, o envio cai na
   * chave global e o boot registra um aviso.
   */
  @IsString()
  @IsOptional()
  EVOLUTION_SYSTEM_APIKEY?: string;

  /** Public URL of THIS backend that Evolution calls back on instance creation. */
  @IsString()
  @IsOptional()
  EVOLUTION_WEBHOOK_URL?: string;

  // ==== Throttle adaptativo (§2.1) — DECISÃO PENDENTE §14 itens 1/2/3 ====
  // Kept as loose strings here and parsed/bounded in ThrottleConfig, which is the single place that
  // knows the valid range of each one. Declaring them keeps `.env.example` and validation in sync.
  @IsString()
  @IsOptional()
  CHANNEL_DEFAULT_QUOTA_FLOOR?: string;

  @IsString()
  @IsOptional()
  CHANNEL_DEFAULT_QUOTA_CEILING?: string;

  @IsString()
  @IsOptional()
  CHANNEL_CIRCUIT_BREAKER_FAILURES?: string;

  @IsString()
  @IsOptional()
  THROTTLE_WINDOW_DAYS?: string;

  @IsString()
  @IsOptional()
  THROTTLE_CLEAN_DAYS_FOR_RAISE?: string;

  @IsString()
  @IsOptional()
  THROTTLE_RAISE_FACTOR?: string;

  @IsString()
  @IsOptional()
  THROTTLE_LOWER_FACTOR?: string;

  @IsString()
  @IsOptional()
  THROTTLE_SEVERE_FAILURE_RATE?: string;

  @IsString()
  @IsOptional()
  THROTTLE_LOW_DELIVERY_RATE?: string;

  @IsString()
  @IsOptional()
  THROTTLE_HIGH_OPT_OUT_RATE?: string;

  @IsString()
  @IsOptional()
  THROTTLE_SEVERE_DISCONNECT_EVENTS?: string;

  @IsString()
  @IsOptional()
  THROTTLE_MIN_SAMPLE?: string;

  /** Timezone the cron uses to decide which day it is closing. */
  @IsString()
  @IsOptional()
  DEFAULT_TIMEZONE: string = 'America/Sao_Paulo';

  // ==== MinIO (storage) ====
  @IsString()
  @IsOptional()
  MINIO_ENDPOINT?: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  @Transform(toInt(9000))
  @IsOptional()
  MINIO_PORT: number = 9000;

  @IsString()
  @IsOptional()
  MINIO_ACCESS_KEY?: string;

  @IsString()
  @IsOptional()
  MINIO_SECRET_KEY?: string;

  @IsBoolean()
  @Transform(toBoolean(true))
  @IsOptional()
  MINIO_USE_SSL: boolean = true;

  /**
   * Prefix of the per-account bucket (`{prefix}{account_id}`). Configurable so that dev and
   * production can share a MinIO instance without colliding on bucket names.
   */
  @IsString()
  @IsOptional()
  MINIO_BUCKET_PREFIX: string = 'batuta-';

  // ==== SMTP (Mailcow) ====
  @IsString()
  @IsOptional()
  SMTP_HOST?: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  @Transform(toInt(465))
  @IsOptional()
  SMTP_PORT: number = 465;

  @IsBoolean()
  @Transform(toBoolean(true))
  @IsOptional()
  SMTP_SECURE: boolean = true;

  @IsString()
  @IsOptional()
  SMTP_USER?: string;

  @IsString()
  @IsOptional()
  SMTP_PASSWORD?: string;

  @IsString()
  @IsOptional()
  SMTP_FROM?: string;

  // ==== Web ====
  @IsString()
  @IsOptional()
  CORS_ORIGIN?: string;

  @IsString()
  @IsOptional()
  FRONTEND_URL: string = 'http://localhost:3003';

  // ==== Error reporter (vazio = no-op) ====
  @IsString()
  @IsOptional()
  ERROR_REPORTER_URL?: string;

  @IsString()
  @IsOptional()
  ERROR_REPORTER_API_KEY?: string;
}

/**
 * Called by ConfigModule at startup. Throws — and therefore aborts the boot — when the
 * environment is invalid. The message lists every offending variable so the operator fixes
 * all of them in one pass; it never echoes the offending VALUE (secrets stay out of logs).
 */
export function validate(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: false,
  });

  const errors = validateSync(validated, {
    skipMissingProperties: false,
    forbidUnknownValues: false,
  });

  if (errors.length > 0) {
    const details = errors
      .map((error) => `${error.property}: ${Object.values(error.constraints ?? {}).join('; ')}`)
      .join('\n  - ');
    throw new Error(
      `Configuração de ambiente inválida (verifique o .env — ver .env.example):\n  - ${details}`,
    );
  }

  return validated;
}
