import { IsString, IsNumber, IsOptional, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

/**
 * Validated environment variables. Secrets are optional at boot so the app can start in
 * development with placeholders; the services that need them fail fast when actually used.
 */
export class EnvironmentVariables {
  @IsString()
  @IsOptional()
  APP_NAME: string = 'Ecoa';

  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @Transform(({ value }) => parseInt(value as string, 10))
  @IsOptional()
  PORT: number = 3001;

  @IsString()
  DATABASE_URL!: string;

  @IsString()
  @IsOptional()
  SUPABASE_URL?: string;

  @IsString()
  @IsOptional()
  SUPABASE_SECRET_KEY?: string;

  @IsString()
  @IsOptional()
  REDIS_HOST: string = 'localhost';

  @IsNumber()
  @Transform(({ value }) => (value ? parseInt(value as string, 10) : 6379))
  @IsOptional()
  REDIS_PORT: number = 6379;

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

  @IsString()
  @IsOptional()
  META_APP_ID?: string;

  @IsString()
  @IsOptional()
  META_APP_SECRET?: string;

  @IsString()
  @IsOptional()
  META_OAUTH_REDIRECT_URI?: string;

  @IsString()
  @IsOptional()
  META_WEBHOOK_VERIFY_TOKEN?: string;

  @IsString()
  @IsOptional()
  META_GRAPH_API_VERSION: string = 'v21.0';

  @IsString()
  @IsOptional()
  IG_TOKEN_ENCRYPTION_KEY?: string;

  @IsString()
  @IsOptional()
  SMTP_HOST?: string;

  @IsNumber()
  @Transform(({ value }) => (value ? parseInt(value as string, 10) : undefined))
  @IsOptional()
  SMTP_PORT?: number;

  @IsString()
  @IsOptional()
  SMTP_USER?: string;

  @IsString()
  @IsOptional()
  SMTP_PASSWORD?: string;

  @IsString()
  @IsOptional()
  SMTP_FROM?: string;

  @IsString()
  @IsOptional()
  CORS_ORIGIN?: string;

  @IsString()
  @IsOptional()
  FRONTEND_URL: string = 'http://localhost:3003';

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
