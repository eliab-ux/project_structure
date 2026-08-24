import { Injectable } from '@nestjs/common';
import {
  BillingProviderPort,
  BillingWebhookEvent,
  RegisterChargeRequest,
  RegisterChargeResult,
} from '../../contexts/billing/application/ports/output/billing-provider.port';
import { BillingProviderNotConfiguredException } from '../../contexts/billing/domain/exceptions/billing-exceptions';

/**
 * O adapter DEFAULT enquanto não há agregador com credencial: RECUSA LOUD (regra da casa — adapter
 * de teste nunca é fallback de produção; boleto de mentira aprovado por um humano é pior que uma
 * mensagem de erro). Quando a credencial do agregador escolhido chegar (Kobana/TecnoSpeed/Asaas),
 * o adapter real substitui ESTE provider no módulo — o resto do sistema não muda (06 §2.1).
 */
@Injectable()
export class NotConfiguredBillingProvider implements BillingProviderPort {
  async registerCharge(_request: RegisterChargeRequest): Promise<RegisterChargeResult> {
    throw new BillingProviderNotConfiguredException();
  }

  async cancelCharge(_configId: string, _providerChargeId: string): Promise<void> {
    throw new BillingProviderNotConfiguredException();
  }

  async testConnection(_configId: string): Promise<{ ok: boolean; message: string }> {
    // O botão Testar responde a verdade em vez de lançar: a tela de config existe justamente
    // para o operador ver ESTE estado e saber o que falta.
    return {
      ok: false,
      message:
        'Nenhum agregador integrado ainda — a credencial (Kobana/TecnoSpeed/Asaas) ativa o adapter real.',
    };
  }

  async parseWebhook(
    _rawBody: string,
    _headers: Record<string, string>,
  ): Promise<BillingWebhookEvent | null> {
    // Sem provedor não há webhook legítimo — payload ignorado (o handler loga).
    return null;
  }
}
