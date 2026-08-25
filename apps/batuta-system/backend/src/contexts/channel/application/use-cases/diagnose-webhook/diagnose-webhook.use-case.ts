import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  WHATSAPP_GATEWAY,
  WhatsAppGatewayPort,
} from '../../../../../infrastructure/whatsapp/ports/whatsapp-gateway.port';
import { parseInstanceName } from '../../../../../infrastructure/whatsapp/instance-name';
import { WebhookRejectionLog } from '../../../../../infrastructure/security/webhook-rejection.log';
import { ChannelId } from '../../../domain/value-objects/channel-id.vo';
import { ChannelNotFoundException } from '../../../domain/exceptions/channel-not-found.exception';
import { WebhookDiagnosisDto } from '../../dto/channel.dto';
import {
  CHANNEL_REPOSITORY,
  ChannelRepositoryPort,
} from '../../ports/output/channel-repository.port';
import {
  WEBHOOK_DIAGNOSIS_SOURCE,
  WebhookDiagnosisSourcePort,
} from '../../ports/output/webhook-diagnosis-source.port';
import { DiagnoseWebhookCommand } from './diagnose-webhook.command';

/** The event without which no reply ever reaches the inbox. */
const INBOUND_EVENT = 'MESSAGES_UPSERT';
/** The event without which every channel reads as 0% delivered and every quota falls to the floor. */
const ACK_EVENT = 'MESSAGES_UPDATE';

/**
 * Reads back what the provider ACTUALLY has configured for a channel's instance.
 *
 * It exists because "the reply never arrived" has at least five causes that are indistinguishable from
 * the outside — no webhook at all, a webhook stored disabled, a webhook without the auth header (so the
 * guard answers 401 and the provider gives up), a webhook missing `MESSAGES_UPSERT`, or the wrong URL —
 * and every one of them looks exactly like "nobody replied". Diagnosing them by reading logs is a
 * round trip through whoever has server access; this turns it into one screen.
 *
 * It reports a `problem` in plain language rather than only the raw fields, because the raw fields are
 * only meaningful to someone who already knows what should be there.
 */
@Injectable()
export class DiagnoseWebhookUseCase implements UseCase<
  DiagnoseWebhookCommand,
  WebhookDiagnosisDto
> {
  private readonly logger = new Logger(DiagnoseWebhookUseCase.name);

  constructor(
    @Inject(CHANNEL_REPOSITORY) private readonly channels: ChannelRepositoryPort,
    @Inject(WHATSAPP_GATEWAY) private readonly gateway: WhatsAppGatewayPort,
    @Inject(WEBHOOK_DIAGNOSIS_SOURCE) private readonly facts: WebhookDiagnosisSourcePort,
    private readonly rejections: WebhookRejectionLog,
  ) {}

  async execute(command: DiagnoseWebhookCommand): Promise<WebhookDiagnosisDto> {
    const channel = await this.channels.findById(ChannelId.from(command.channelId));
    if (!channel) {
      throw new ChannelNotFoundException();
    }

    const instance = {
      instanceName: channel.evolutionInstanceName,
      accountId: command.accountId,
    };

    let reconfigured: boolean | null = null;
    if (command.reconfigure) {
      reconfigured = await this.gateway.ensureWebhook(instance);
      this.logger.log('Webhook reconfigurado sob demanda', {
        channelId: channel.id.value,
        ok: reconfigured,
      });
    }

    const [info, facts] = await Promise.all([
      this.gateway.findWebhook(instance),
      this.facts.inboundFacts(channel.id.value),
    ]);
    const rejections = this.rejections.snapshot();

    const dto = new WebhookDiagnosisDto();
    dto.channelId = channel.id.value;
    dto.channelLabel = channel.label;
    dto.reconfigured = reconfigured;
    dto.configured = info !== null;
    dto.enabled = info?.enabled ?? false;
    dto.url = info?.url ?? null;
    dto.events = info?.events ?? [];
    dto.hasAuthHeader = info?.hasAuthHeader ?? false;
    dto.receivesInbound = dto.events.includes(INBOUND_EVENT);
    dto.receivesAcks = dto.events.includes(ACK_EVENT);

    dto.instanceName = channel.evolutionInstanceName;
    dto.instanceNameAttributable = parseInstanceName(channel.evolutionInstanceName) !== null;
    dto.inboundCount = facts.inboundCount;
    dto.lastInboundAt = facts.lastInboundAt;
    dto.contactsTotal = facts.contactsTotal;
    dto.contactsWithoutNinthDigit = facts.contactsWithoutNinthDigit;
    dto.invalidTokenRejections = rejections.invalidTokenCount;
    dto.lastInvalidTokenAt = rejections.lastInvalidTokenAt;

    dto.problem = DiagnoseWebhookUseCase.diagnose(dto);
    return dto;
  }

  /**
   * The first blocking problem, in the order they block.
   *
   * One at a time and not a list: they are sequential — a webhook that does not exist cannot also be
   * missing an event — and showing five simultaneous complaints for one cause reads as five faults.
   *
   * The order now covers the whole chain, not just the provider's config, because "everything green and
   * the inbox still empty" was a real outcome and it cost a long investigation through container logs.
   * Two rules govern the placement:
   *
   *  - the instance name comes FIRST, ahead of every webhook check, because if it does not parse then
   *    reconfiguring the webhook is futile — the inbound is discarded before any of this matters, and an
   *    operator who clicks "Reconfigurar" would believe they had fixed it;
   *  - the inbound facts come LAST, because they are evidence rather than configuration: they only mean
   *    something once nothing structural is wrong.
   */
  private static diagnose(dto: WebhookDiagnosisDto): string | null {
    if (!dto.instanceNameAttributable) {
      return (
        `A instância "${dto.instanceName}" não segue o padrão acct-{conta}-ch-{canal}, que é como uma ` +
        'mensagem recebida descobre a qual conta pertence. Toda resposta deste chip é descartada antes ' +
        'de qualquer outra coisa, e reconfigurar o webhook NÃO resolve: é preciso recriar o canal para ' +
        'que a instância nasça com o nome certo.'
      );
    }
    if (!dto.configured) {
      return (
        'A Evolution não tem webhook configurado para esta instância (ou não respondeu à consulta). ' +
        'Nenhuma resposta de contato chega, e nenhum recibo de entrega — o que faz a cota de todos os ' +
        'canais cair para o piso. Use "Reconfigurar webhook".'
      );
    }
    if (!dto.enabled) {
      return (
        'O webhook existe mas está DESABILITADO. A instância parece configurada e não entrega nada. ' +
        'Use "Reconfigurar webhook".'
      );
    }
    if (!dto.hasAuthHeader) {
      return (
        'O webhook não envia o cabeçalho de autenticação, então este backend recusa cada chamada com ' +
        '401 e a Evolution desiste. Use "Reconfigurar webhook".'
      );
    }
    if (!dto.receivesInbound) {
      return (
        `O webhook está ativo mas não assina ${INBOUND_EVENT}: mudanças de conexão chegam, respostas ` +
        'de contato não. Use "Reconfigurar webhook".'
      );
    }
    if (!dto.receivesAcks) {
      return (
        `O webhook não assina ${ACK_EVENT}. As respostas chegam, mas sem recibo de entrega o throttle ` +
        'lê 0% de entrega e derruba a cota de canais saudáveis. Use "Reconfigurar webhook".'
      );
    }

    // Beyond here the provider's side is correct, so anything left is downstream of the POST.

    if (dto.invalidTokenRejections > 0) {
      return (
        `A Evolution ESTÁ chamando este backend, e ${dto.invalidTokenRejections} chamada(s) foram ` +
        'recusadas por token inválido. O cabeçalho existe, mas o valor não bate com ' +
        '`EVOLUTION_WEBHOOK_TOKEN` — provavelmente a variável foi trocada depois que a instância foi ' +
        'criada. Use "Reconfigurar webhook" para regravar o token na instância.'
      );
    }

    if (dto.inboundCount === 0 && dto.contactsWithoutNinthDigit > 0) {
      return (
        `Nenhuma resposta foi gravada neste canal, e ${dto.contactsWithoutNinthDigit} de ` +
        `${dto.contactsTotal} contato(s) dele estão sem o nono dígito. Esse é o defeito em que o ENVIO ` +
        'funciona e só a VOLTA quebra: o WhatsApp entrega no número antigo, mas devolve o identificador ' +
        'na forma com o 9, e aí a resposta não casa com nenhum contato da base e é descartada. Corrija ' +
        'o número dos contatos (ou reimporte com o nono dígito).'
      );
    }

    if (dto.inboundCount === 0) {
      return (
        'A configuração está correta e nenhuma resposta foi gravada neste canal. Se você sabe que ' +
        'alguém respondeu, então a chamada não está chegando ao backend: procure ' +
        '`POST /api/webhooks/evolution` no log do backend no horário da resposta. Se a linha não ' +
        'existir, o problema é de rede/domínio, não do Batuta. Lembre que respostas anteriores à ' +
        'configuração do webhook não são recuperáveis — não existe importação de histórico.'
      );
    }

    return null;
  }
}
