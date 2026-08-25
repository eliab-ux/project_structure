import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { ThrottleConfig } from '../../../../../config/throttle.config';
import { ThrottleThresholds } from '../../../../channel/domain/services/throttle-policy';
import {
  ChannelHealthRow,
  HEALTH_PANEL_SOURCE,
  HealthPanelSourcePort,
} from '../../ports/output/audit-query.port';
import { GetHealthPanelQuery } from './get-health-panel.query';

const DEFAULT_WINDOW_DAYS = 14;
const MAX_WINDOW_DAYS = 90;

export class ChannelHealthDto {
  channelId!: string;
  label!: string;
  status!: string;
  currentQuota!: number;
  quotaFloor!: number;
  quotaCeiling!: number;
  daily!: { date: string; campaignSends: number; replySends: number }[];
  lastDecision!: {
    date: string;
    decision: string;
    reason: string;
    computedQuota: number;
  } | null;
  /** Sends behind the rates below — the sample size, shown so the operator can judge the rates. */
  sentCount!: number;
  deliveryRate!: number | null;
  inboundRate!: number | null;
  optOutRate!: number | null;
  failureRate!: number | null;
  consecutiveFailures!: number;
  /**
   * A short, honest reading of the numbers above.
   *
   * Computed here rather than in the UI because the thresholds that matter belong to the domain, not to
   * a screen — and because two clients rendering the same numbers with different colours would give two
   * different answers to "is this chip in trouble?".
   *
   * `UNKNOWN` is the state for "there is not enough traffic to say", and it is not a nicety: without it
   * the only way to express a rate computed over three sends is to pick one of the other four, and the
   * one that fits the arithmetic is AT_RISK.
   */
  assessment!: 'HEALTHY' | 'WATCH' | 'AT_RISK' | 'STOPPED' | 'UNKNOWN';
  assessmentReason!: string;
}

export class HealthPanelDto {
  windowDays!: number;
  channels!: ChannelHealthDto[];
  inboundPerDay!: { date: string; count: number }[];
  optOutsInWindow!: number;
  contactsTotal!: number;
  contactsRoutable!: number;
  /** Sustained daily reach: the sum of the current quotas of channels that can actually send. */
  dailyCapacity!: number;
  /** Days to cover the routable base at the current capacity — §15 risco 3, made explicit. */
  daysToCoverBase!: number | null;
}

/**
 * The health panel (§11 item 3).
 *
 * §11 lists the metrics; the interesting decision is what to compute for the operator rather than show
 * raw. Two of them:
 *
 *  1. **`assessment`** turns five rates into one word per chip. An operator scanning ten channels needs
 *     to know where to look, and "delivery 0.82 / opt-out 0.03 / failures 2" is not that.
 *  2. **`daysToCoverBase`** states the constraint §15 risco 3 warns about: "10 chips a 150/dia sustentado
 *     são ~1.500 envios/dia. Uma base de 10.000 contatos leva ~7 dias." That sentence is the single most
 *     common source of disappointed expectations in this product, so the panel says it as a number
 *     instead of leaving it to be discovered mid-campaign.
 */
@Injectable()
export class GetHealthPanelUseCase implements UseCase<GetHealthPanelQuery, HealthPanelDto> {
  constructor(
    @Inject(HEALTH_PANEL_SOURCE) private readonly source: HealthPanelSourcePort,
    // The panel reads the SAME thresholds the throttle acts on. Injected rather than duplicated so a
    // recalibration cannot leave the screen and the decision disagreeing about the same numbers.
    private readonly throttleConfig: ThrottleConfig,
  ) {}

  async execute(query: GetHealthPanelQuery): Promise<HealthPanelDto> {
    const windowDays = Math.min(
      Math.max(query.windowDays ?? DEFAULT_WINDOW_DAYS, 1),
      MAX_WINDOW_DAYS,
    );

    const data = await this.source.load(windowDays);
    const thresholds = this.throttleConfig.thresholds;

    const channels = data.channels.map((channel) => {
      const assessed = GetHealthPanelUseCase.assess(channel, thresholds);
      const dto = new ChannelHealthDto();
      dto.channelId = channel.channelId;
      dto.label = channel.label;
      dto.status = channel.status;
      dto.currentQuota = channel.currentQuota;
      dto.quotaFloor = channel.quotaFloor;
      dto.quotaCeiling = channel.quotaCeiling;
      dto.daily = channel.daily;
      dto.lastDecision = channel.lastDecision;
      dto.sentCount = channel.sentCount;
      dto.deliveryRate = channel.deliveryRate;
      dto.inboundRate = channel.inboundRate;
      dto.optOutRate = channel.optOutRate;
      dto.failureRate = channel.failureRate;
      dto.consecutiveFailures = channel.consecutiveFailures;
      dto.assessment = assessed.assessment;
      dto.assessmentReason = assessed.reason;
      return dto;
    });

    const dailyCapacity = data.channels
      .filter((channel) => channel.status === 'CONNECTED')
      .reduce((sum, channel) => sum + channel.currentQuota, 0);

    const dto = new HealthPanelDto();
    dto.windowDays = windowDays;
    dto.channels = channels;
    dto.inboundPerDay = data.inboundPerDay;
    dto.optOutsInWindow = data.optOutsInWindow;
    dto.contactsTotal = data.contactsTotal;
    dto.contactsRoutable = data.contactsRoutable;
    dto.dailyCapacity = dailyCapacity;
    dto.daysToCoverBase =
      dailyCapacity > 0 ? Math.ceil(data.contactsRoutable / dailyCapacity) : null;
    return dto;
  }

  /**
   * One word per chip, in severity order.
   *
   * The thresholds are the throttle's own (§2.1 / ThrottleConfig), passed in rather than repeated: a
   * panel that called a channel healthy while the throttle was cutting its quota would be lying to the
   * operator about the same numbers. Two places where it legitimately differs:
   *
   *  - the **WATCH** band exists only here. The throttle either acts or holds; an operator benefits from
   *    seeing "not acted on yet, but drifting".
   *  - **UNKNOWN** likewise. The throttle expresses "amostra insuficiente" as HOLD, which is a
   *    non-action; a screen has to render something, and rendering it as a verdict is what produced a
   *    false "perfil de número sendo bloqueado" on a chip with a handful of sends and no acks counted.
   *
   * Order of checks, and why: rate-based verdicts sit BEHIND the minimum sample, because a rate over
   * three sends is noise and the throttle refuses to act on it. Raw COUNTS (`consecutiveFailures`) sit in
   * front of it, because a count means the same thing at any volume — three failures in a row is three
   * failures in a row, whether the chip sent five messages or five hundred.
   */
  private static assess(
    channel: ChannelHealthRow,
    thresholds: ThrottleThresholds,
  ): {
    assessment: ChannelHealthDto['assessment'];
    reason: string;
  } {
    if (channel.status !== 'CONNECTED') {
      return {
        assessment: 'STOPPED',
        reason: `O canal está ${channel.status} e não envia.`,
      };
    }

    const hasSample = channel.sentCount >= thresholds.minSampleForDecision;

    if (hasSample) {
      if (channel.failureRate !== null && channel.failureRate >= thresholds.severeFailureRate) {
        return {
          assessment: 'AT_RISK',
          reason: `${Math.round(channel.failureRate * 100)}% dos envios falharam — parece problema de instância, não de público.`,
        };
      }
      if (channel.optOutRate !== null && channel.optOutRate >= thresholds.highOptOutRate) {
        return {
          assessment: 'AT_RISK',
          reason: `${(channel.optOutRate * 100).toFixed(1)}% pediram para sair — é o sinal de rejeição mais honesto que existe.`,
        };
      }
      // EXACTLY zero deliveries over a real sample is not the signature of blocking — it is the
      // signature of nothing being counted. A blocked number still reaches everyone who did NOT block
      // it, so a genuinely blocked chip lands somewhere in the middle (20%, 60%), never on a clean 0 of
      // 400. Reporting this as "perfil de número sendo bloqueado" accused the chip for what was a broken
      // ack pipeline, and sent us hunting a number that was never the problem.
      if (channel.deliveryRate === 0) {
        return {
          assessment: 'WATCH',
          reason:
            `${channel.sentCount} envios e NENHUM recibo de entrega contado. Entrega exatamente zero ` +
            'nesse volume não é bloqueio — número bloqueado ainda entrega para quem não bloqueou. ' +
            'O que não está chegando é o recibo: confira o webhook do canal (evento MESSAGES_UPDATE). ' +
            'A saúde real deste chip é desconhecida enquanto isso.',
        };
      }
      if (channel.deliveryRate !== null && channel.deliveryRate < thresholds.lowDeliveryRate) {
        return {
          assessment: 'AT_RISK',
          reason: `Só ${Math.round(channel.deliveryRate * 100)}% das ${channel.sentCount} mensagens enviadas foram entregues — perfil de número sendo bloqueado.`,
        };
      }
    }

    if (channel.consecutiveFailures >= 3) {
      return {
        assessment: 'WATCH',
        reason: `${channel.consecutiveFailures} falhas consecutivas: perto de abrir o circuit breaker.`,
      };
    }

    if (!hasSample) {
      return {
        assessment: 'UNKNOWN',
        reason:
          `Amostra insuficiente para avaliar: ${channel.sentCount} envio(s) na janela ` +
          `(mínimo ${thresholds.minSampleForDecision}). A cota não é alterada com tão pouco tráfego.`,
      };
    }

    if (channel.inboundRate !== null && channel.inboundRate < 0.01) {
      return {
        assessment: 'WATCH',
        // §10.4: a chip that only talks and never listens is the profile that gets banned.
        reason: 'Quase nenhuma resposta recebida: chip que só fala e não ouve é o perfil que cai.',
      };
    }

    return { assessment: 'HEALTHY', reason: 'Sinais dentro do esperado.' };
  }
}
