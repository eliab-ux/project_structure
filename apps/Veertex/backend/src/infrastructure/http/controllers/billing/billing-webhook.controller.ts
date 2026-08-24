import { Body, Controller, Headers, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import {
  HandleBillingWebhookCommand,
  HandleBillingWebhookUseCase,
  WebhookResult,
} from '../../../../contexts/billing/application/use-cases/handle-billing-webhook/handle-billing-webhook.use-case';
import { verifyWebhookToken } from '../../../../contexts/billing/application/use-cases/billing-config/billing-config.use-cases';
import {
  BILLING_CONFIG_REPOSITORY,
  BillingConfigRepositoryPort,
} from '../../../../contexts/billing/application/ports/output/billing-config-repository.port';
import {
  CREDENTIALS_CIPHER,
  CredentialsCipherPort,
} from '../../../../contexts/billing/application/ports/output/billing-support.ports';
import { Inject, Logger } from '@nestjs/common';
import { TenantContextService } from '../../../security/tenant-context.service';

/**
 * PÚBLICO — é o PROVEDOR quem chama (não há JWT de usuário; o agregador não faz login).
 * A autenticação é o TOKEN da URL (gerado no salvar da config, guardado como hash, comparado em
 * tempo constante) + a validação de assinatura do próprio adapter no parse. O escopo do tenant é
 * estabelecido do `accountId` da URL ANTES de qualquer leitura — quarto call site nomeado do
 * `establishFromAuthenticatedUser` (login, reset e webhook: os lugares onde o tenant não vem de
 * token JWT). Token inválido responde IGUAL a payload desconhecido (`ignored`) — sem oráculo.
 */
@Controller('billing/webhook')
export class BillingWebhookController {
  private readonly logger = new Logger(BillingWebhookController.name);

  constructor(
    private readonly handleWebhook: HandleBillingWebhookUseCase,
    private readonly tenant: TenantContextService,
    @Inject(BILLING_CONFIG_REPOSITORY) private readonly configs: BillingConfigRepositoryPort,
    @Inject(CREDENTIALS_CIPHER) private readonly cipher: CredentialsCipherPort,
  ) {}

  @Post(':accountId/:configId')
  @HttpCode(200)
  async receive(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Param('configId', ParseUUIDPipe) configId: string,
    @Query('token') token: string | undefined,
    @Body() body: unknown,
    @Headers() headers: Record<string, string>,
  ): Promise<WebhookResult> {
    // Escopo do tenant a partir da URL — sem ele nem a config é legível (RLS).
    await this.tenant.establishFromAuthenticatedUser(accountId);

    const config = await this.configs.findById(configId);
    if (!config || !token || !verifyWebhookToken(this.cipher, config, token)) {
      // Resposta idêntica ao payload não reconhecido: 200/ignored — provedor não fica em retry e
      // ninguém sonda a existência de contas/configs por diferença de status.
      this.logger.warn('Webhook recusado (config/token)', { configId });
      return { outcome: 'ignored' };
    }

    return this.handleWebhook.execute(
      new HandleBillingWebhookCommand(
        accountId,
        configId,
        typeof body === 'string' ? body : JSON.stringify(body ?? {}),
        headers,
      ),
    );
  }
}
