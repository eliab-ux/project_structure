import { randomUUID, createHash, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  BILLING_CONFIG_REPOSITORY,
  BillingConfigRepositoryPort,
  BillingProviderConfig,
} from '../../ports/output/billing-config-repository.port';
import {
  CREDENTIALS_CIPHER,
  CredentialsCipherPort,
} from '../../ports/output/billing-support.ports';
import { BILLING_PROVIDER, BillingProviderPort } from '../../ports/output/billing-provider.port';
import {
  BillingProviderNotConfiguredException,
  InvalidChargeException,
} from '../../../domain/exceptions/billing-exceptions';

export class SetBillingConfigCommand {
  constructor(
    public readonly accountId: string,
    public readonly input: {
      provider: 'kobana' | 'tecnospeed' | 'asaas';
      /** Em claro SÓ aqui (trânsito) — cifrada antes de persistir; nunca devolvida. */
      credentials: string;
      agreementCode?: string | null;
      settlementAccountId: string;
      companyId?: string | null;
    },
  ) {}
}

export interface BillingConfigDto {
  id: string;
  provider: string;
  agreementCode: string | null;
  settlementAccountId: string;
  companyId: string | null;
  active: boolean;
  /** URL do webhook para cadastrar no provedor — inclui o token; exibida SÓ ao salvar. */
  webhookPath: string | null;
}

/**
 * Configura o provedor (06 fatia 1): credencial CIFRADA em repouso; o webhook ganha um TOKEN
 * próprio (mostrado UMA vez, guardado como hash) — é ele que autentica o provedor na URL pública,
 * e é por ele que o request estabelece o escopo do tenant antes de qualquer leitura.
 */
@Injectable()
export class SetBillingConfigUseCase implements UseCase<SetBillingConfigCommand, BillingConfigDto> {
  constructor(
    @Inject(BILLING_CONFIG_REPOSITORY) private readonly configs: BillingConfigRepositoryPort,
    @Inject(CREDENTIALS_CIPHER) private readonly cipher: CredentialsCipherPort,
  ) {}

  async execute(command: SetBillingConfigCommand): Promise<BillingConfigDto> {
    if (!command.input.credentials.trim()) {
      throw new InvalidChargeException('Informe a credencial do provedor.');
    }
    const webhookToken = randomUUID().replace(/-/g, '');
    const existing = await this.configs.getForAccount(command.input.companyId ?? null);
    const config: BillingProviderConfig = {
      id: existing?.id ?? randomUUID(),
      accountId: command.accountId,
      companyId: command.input.companyId ?? null,
      provider: command.input.provider,
      encryptedCredentials: this.cipher.encrypt(
        JSON.stringify({ credentials: command.input.credentials, webhookTokenHash: sha256(webhookToken) }),
      ),
      agreementCode: command.input.agreementCode ?? null,
      settlementAccountId: command.input.settlementAccountId,
      active: true,
      createdAt: existing?.createdAt ?? new Date(),
    };
    const saved = await this.configs.save(config);
    return {
      id: saved.id,
      provider: saved.provider,
      agreementCode: saved.agreementCode,
      settlementAccountId: saved.settlementAccountId,
      companyId: saved.companyId,
      active: saved.active,
      // Mostrada UMA vez — o hash não se inverte; perder = salvar de novo (token novo).
      webhookPath: `/api/billing/webhook/${command.accountId}/${saved.id}?token=${webhookToken}`,
    };
  }
}

@Injectable()
export class GetBillingConfigUseCase implements UseCase<void, BillingConfigDto | null> {
  constructor(
    @Inject(BILLING_CONFIG_REPOSITORY) private readonly configs: BillingConfigRepositoryPort,
  ) {}

  async execute(): Promise<BillingConfigDto | null> {
    const config = await this.configs.getForAccount(null);
    if (!config) {
      return null;
    }
    return {
      id: config.id,
      provider: config.provider,
      agreementCode: config.agreementCode,
      settlementAccountId: config.settlementAccountId,
      companyId: config.companyId,
      active: config.active,
      webhookPath: null, // o token não se re-exibe — hash não se inverte
    };
  }
}

@Injectable()
export class TestBillingConnectionUseCase implements UseCase<void, { ok: boolean; message: string }> {
  constructor(
    @Inject(BILLING_CONFIG_REPOSITORY) private readonly configs: BillingConfigRepositoryPort,
    @Inject(BILLING_PROVIDER) private readonly provider: BillingProviderPort,
  ) {}

  async execute(): Promise<{ ok: boolean; message: string }> {
    const config = await this.configs.getForAccount(null);
    if (!config) {
      throw new BillingProviderNotConfiguredException();
    }
    return this.provider.testConnection(config.id);
  }
}

/** Valida o token do webhook contra o hash guardado na config — comparação de tempo constante. */
export function verifyWebhookToken(
  cipher: CredentialsCipherPort,
  config: BillingProviderConfig,
  token: string,
): boolean {
  try {
    const payload = JSON.parse(cipher.decrypt(config.encryptedCredentials)) as {
      webhookTokenHash?: string;
    };
    if (!payload.webhookTokenHash) {
      return false;
    }
    const expected = Buffer.from(payload.webhookTokenHash, 'hex');
    const received = Buffer.from(sha256(token), 'hex');
    return expected.length === received.length && timingSafeEqual(expected, received);
  } catch {
    return false;
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
