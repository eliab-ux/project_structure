import { IsString, IsNumber, IsOptional, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @Transform(({ value }) => parseInt(value, 10))
  PORT: number = 3000;

  @IsString()
  DATABASE_URL!: string;

  @IsString()
  SUPABASE_URL!: string;

  @IsString()
  SUPABASE_ANON_KEY!: string;

  @IsString()
  SUPABASE_SERVICE_ROLE_KEY!: string;

  @IsString()
  @IsOptional()
  JWT_SECRET?: string;

  @IsString()
  @IsOptional()
  JWT_EXPIRES_IN: string = '7d';

  @IsString()
  @IsOptional()
  JWT_REFRESH_SECRET?: string;

  @IsString()
  @IsOptional()
  JWT_REFRESH_EXPIRES_IN: string = '30d';

  @IsString()
  @IsOptional()
  BLING_CLIENT_ID?: string;

  @IsString()
  @IsOptional()
  BLING_CLIENT_SECRET?: string;

  @IsString()
  @IsOptional()
  BLING_REDIRECT_URI?: string;

  @IsString()
  @IsOptional()
  BLING_API_URL?: string;

  @IsString()
  @IsOptional()
  MAGIS5_API_URL?: string;

  @IsString()
  @IsOptional()
  MAGIS5_API_KEY?: string;

  @IsString()
  @IsOptional()
  CIELO_ENVIRONMENT?: string;

  @IsString()
  @IsOptional()
  CIELO_MERCHANT_ID?: string;

  @IsString()
  @IsOptional()
  CIELO_MERCHANT_KEY?: string;

  @IsString()
  @IsOptional()
  CIELO_WEBHOOK_SECRET?: string;

  @IsString()
  @IsOptional()
  CIELO_API_URL?: string;

  @IsString()
  @IsOptional()
  CIELO_QUERY_URL?: string;

  @IsString()
  @IsOptional()
  CIELO_RECURRENCE_URL?: string;

  @IsString()
  @IsOptional()
  MELHOR_ENVIO_API_URL?: string;

  @IsString()
  @IsOptional()
  MELHOR_ENVIO_TOKEN?: string;

  @IsString()
  APP_URL!: string;

  @IsString()
  FRONTEND_URL!: string;

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
  SMTP_PASS?: string;

  @IsString()
  @IsOptional()
  EMAIL_FROM?: string;

  @IsString()
  @IsOptional()
  EMAIL_FROM_NAME?: string;

  @IsNumber()
  @Transform(({ value }) => parseFloat(value as string))
  @IsOptional()
  SUBSCRIPTION_PRICE: number = 9.9;

  @IsNumber()
  @Transform(({ value }) => parseFloat(value as string))
  @IsOptional()
  WITHDRAWAL_MIN_AMOUNT: number = 50;

  @IsNumber()
  @Transform(({ value }) => parseInt(value as string, 10))
  @IsOptional()
  WITHDRAWAL_RELEASE_DAYS: number = 30;

  @IsOptional()
  @IsString()
  CORS_ORIGIN?: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = new EnvironmentVariables();
  Object.assign(validatedConfig, config);
  return validatedConfig;
}
