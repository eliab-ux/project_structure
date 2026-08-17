import { Transform, plainToInstance } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min, validateSync } from 'class-validator';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

/** parseInt que preserva o default da classe quando a variável está ausente ou em branco. */
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
 * Variáveis de ambiente validadas — falha rápido no boot.
 *
 * O que é OBRIGATÓRIO aqui é só o que a aplicação precisa para subir (DATABASE_URL). Segredo de
 * integração (Evolution) é opcional no boot e validado pelo adapter que o consome, para que um
 * ambiente parcialmente configurado ainda suba e reporte o erro no ponto de uso, em vez de morrer
 * com uma falha de boot genérica.
 *
 * Nunca acrescente variável aqui sem acrescentá-la também ao `.env.example` (CLAUDE.md).
 */
export class EnvironmentVariables {
  // ==== Aplicação ====
  @IsString()
  @IsOptional()
  KORTEX_APP_NAME: string = 'Kortex';

  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsInt()
  @Min(1)
  @Max(65535)
  @Transform(toInt(3030))
  @IsOptional()
  PORT: number = 3030;

  @IsString()
  @IsOptional()
  HOST: string = '0.0.0.0';

  // ==== Banco ====
  @IsString()
  DATABASE_URL!: string;

  /** Só os testes de integração leem esta — a aplicação nunca conecta nela. */
  @IsString()
  @IsOptional()
  DATABASE_URL_TEST?: string;

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

  // ==== Evolution API (WhatsApp) ====
  @IsString()
  @IsOptional()
  EVOLUTION_API_URL?: string;

  /**
   * Instância DE SISTEMA — o canal do código de recuperação de senha. Nunca um chip de cliente.
   */
  @IsString()
  @IsOptional()
  EVOLUTION_SYSTEM_INSTANCE?: string;

  /** Apikey DA INSTÂNCIA de sistema. Menor privilégio — não é a chave global do servidor. */
  @IsString()
  @IsOptional()
  EVOLUTION_SYSTEM_APIKEY?: string;

  // ==== Web ====
  @IsString()
  @IsOptional()
  CORS_ORIGIN?: string;

  @IsString()
  @IsOptional()
  FRONTEND_URL: string = 'http://localhost:3031';

  // ==== Error reporter (vazio = no-op) ====
  @IsString()
  @IsOptional()
  ERROR_REPORTER_URL?: string;

  @IsString()
  @IsOptional()
  ERROR_REPORTER_API_KEY?: string;
}

/**
 * Chamada pelo ConfigModule no boot. Lança — e portanto aborta a subida — quando o ambiente está
 * inválido. A mensagem lista todas as variáveis com problema para o operador corrigir tudo numa
 * passada; nunca ecoa o VALOR (segredo não entra em log).
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
