import { Transform, plainToInstance } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min, validateSync } from 'class-validator';

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

/**
 * Validated environment variables — fail fast at startup rather than at the first request.
 *
 * What is REQUIRED here is only what the app needs to boot at all (`DATABASE_URL`). Integration
 * secrets (Evolution) are optional at boot and checked by the adapter that consumes them, so a
 * partially configured environment still starts and reports a precise error at the point of use
 * instead of a vague boot failure — a missing WhatsApp instance must not stop the ERP.
 *
 * The JWT secrets are optional HERE and mandatory in production: `JwtTokenService.onModuleInit`
 * demands them when `NODE_ENV=production`, so a developer can boot without them while a production
 * deploy without them refuses to start.
 *
 * Never add a variable here without also adding it to `.env.example` (CLAUDE.md).
 */
export class EnvironmentVariables {
  // ==== Aplicação ====
  @IsString()
  @IsOptional()
  VEERTEX_APP_NAME: string = 'Veertex';

  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsInt()
  @Min(1)
  @Max(65535)
  @Transform(toInt(3020))
  @IsOptional()
  PORT: number = 3020;

  @IsString()
  @IsOptional()
  HOST: string = '0.0.0.0';

  // ==== Banco ====
  /** Runtime role (`veertex_app`) — sem DDL, sujeito ao RLS. */
  @IsString()
  DATABASE_URL!: string;

  /**
   * Owner role (`veertex_owner`) — migrations e CLI. Opcional no boot porque a APLICAÇÃO nunca a
   * usa: quem a exige é o CLI do MikroORM, que valida por conta própria.
   */
  @IsString()
  @IsOptional()
  DATABASE_URL_MIGRATIONS?: string;

  /**
   * Nomes dos papéis, lidos pelo bootstrap e por `verify:isolation`. Declarados aqui para que
   * `.env.example` e a validação não divirjam (CLAUDE.md).
   */
  @IsString()
  @IsOptional()
  DATABASE_OWNER_ROLE?: string;

  @IsString()
  @IsOptional()
  DATABASE_APP_ROLE?: string;

  /**
   * `false` desliga a aplicação automática de migrations no boot (deploy controlado).
   *
   * String e não boolean de propósito: só o literal `'false'` desliga. Um valor digitado errado
   * (`0`, `no`, vazio) mantém o comportamento padrão — se um typo pudesse desligar a migration
   * silenciosamente, a aplicação subiria contra um schema atrasado e o erro apareceria em runtime,
   * longe da causa.
   *
   * A VERIFICAÇÃO de isolamento roda sempre, independentemente desta flag.
   */
  @IsString()
  @IsOptional()
  AUTO_MIGRATE?: string;

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

  // ==== Evolution API (WhatsApp — código de recuperação de senha) ====
  // O TTL do código NÃO é variável de ambiente: 15 minutos vivem em RESET_CODE_TTL_MINUTES, na
  // entidade de domínio, porque é regra de negócio. O canal é instantâneo; não há o que ajustar.
  @IsString()
  @IsOptional()
  EVOLUTION_API_URL?: string;

  /** Instância de SISTEMA. Nunca um chip de tenant — ver o adapter. */
  @IsString()
  @IsOptional()
  EVOLUTION_SYSTEM_INSTANCE?: string;

  /** Apikey DA INSTÂNCIA (menor privilégio), nunca a chave global do servidor Evolution. */
  @IsString()
  @IsOptional()
  EVOLUTION_SYSTEM_APIKEY?: string;

  // ==== Web ====
  @IsString()
  @IsOptional()
  CORS_ORIGIN?: string;

  @IsString()
  @IsOptional()
  FRONTEND_URL: string = 'http://localhost:3021';

  // ==== Error reporter (VEXGuard — vazio = no-op) ====
  @IsString()
  @IsOptional()
  ERROR_REPORTER_URL?: string;

  @IsString()
  @IsOptional()
  ERROR_REPORTER_API_KEY?: string;
}

/**
 * Called by ConfigModule at startup. Throws — and therefore aborts the boot — when the environment
 * is invalid. The message lists every offending variable so the operator fixes all of them in one
 * pass; it never echoes the offending VALUE, because these are secrets and this goes to a log.
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
