import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import {
  FINANCIAL_TITLE_REPOSITORY,
  FinancialTitleRepositoryPort,
} from '../../../../finance/application/ports/output/financial-title-repository.port';
import { FinancialTitle } from '../../../../finance/domain/entities/financial-title.entity';
import {
  DunningChannel,
  DunningEvent,
  DunningRule,
  DunningStep,
} from '../../../domain/entities/dunning.entity';
import { DunningRuleInvalidException } from '../../../domain/exceptions/billing-exceptions';
import {
  DUNNING_EVENT_REPOSITORY,
  DUNNING_RULE_REPOSITORY,
  DunningEventRepositoryPort,
  DunningRuleRepositoryPort,
} from '../../ports/output/billing-repositories.port';
import {
  BILLING_PAYER_LOOKUP,
  BillingPayerLookupPort,
  DUNNING_MESSENGER,
  DunningMessengerPort,
} from '../../ports/output/billing-support.ports';

const DAY_MS = 86_400_000;

// ── Régua: configuração ──────────────────────────────────────────────────────────────────────────

export class SaveDunningRuleCommand {
  constructor(
    public readonly accountId: string,
    public readonly actorUserId: string,
    public readonly input: {
      steps: {
        offsetDays: number;
        channel: DunningChannel;
        template: string;
        mode: 'propose' | 'auto';
      }[];
      maxRebillings?: number | null;
    },
  ) {}
}

export interface DunningRuleDto {
  id: string;
  steps: {
    id: string;
    offsetDays: number;
    channel: string;
    template: string;
    mode: string;
    autoEnabledByUserId: string | null;
    autoEnabledAt: string | null;
  }[];
  maxRebillings: number;
}

export function ruleToDto(rule: DunningRule): DunningRuleDto {
  return {
    id: rule.id,
    steps: rule.steps.map((step) => ({
      id: step.id,
      offsetDays: step.offsetDays,
      channel: step.channel,
      template: step.template,
      mode: step.mode,
      autoEnabledByUserId: step.autoEnabledByUserId,
      autoEnabledAt: step.autoEnabledAt ? step.autoEnabledAt.toISOString() : null,
    })),
    maxRebillings: rule.maxRebillings,
  };
}

@Injectable()
export class SaveDunningRuleUseCase implements UseCase<SaveDunningRuleCommand, DunningRuleDto> {
  constructor(
    @Inject(DUNNING_RULE_REPOSITORY) private readonly rules: DunningRuleRepositoryPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: SaveDunningRuleCommand): Promise<DunningRuleDto> {
    return this.uow.execute(async () => {
      const existing = await this.rules.getForAccount();
      let rule: DunningRule;
      if (existing) {
        existing.replaceSteps(command.input.steps, command.actorUserId);
        if (command.input.maxRebillings !== null && command.input.maxRebillings !== undefined) {
          existing.setMaxRebillings(command.input.maxRebillings);
        }
        rule = existing;
      } else {
        rule = DunningRule.create({
          accountId: command.accountId,
          steps: command.input.steps,
          maxRebillings: command.input.maxRebillings,
        });
        // `create` não registra o ator do opt-in — reaplica com o ator quando houver etapa auto.
        if (command.input.steps.some((step) => step.mode === 'auto')) {
          rule.replaceSteps(command.input.steps, command.actorUserId);
        }
      }
      return ruleToDto(await this.rules.save(rule));
    });
  }
}

@Injectable()
export class GetDunningRuleUseCase implements UseCase<void, DunningRuleDto | null> {
  constructor(@Inject(DUNNING_RULE_REPOSITORY) private readonly rules: DunningRuleRepositoryPort) {}

  async execute(): Promise<DunningRuleDto | null> {
    const rule = await this.rules.getForAccount();
    return rule ? ruleToDto(rule) : null;
  }
}

// ── Régua: execução ──────────────────────────────────────────────────────────────────────────────

export class RunDunningCommand {
  constructor(
    public readonly accountId: string,
    /** Injetável no teste; produção usa o relógio. */
    public readonly now: Date = new Date(),
  ) {}
}

export interface DunningRunResult {
  proposed: number;
  sent: number;
  writtenOffPending: string[];
}

/**
 * RODA a régua (06 §2.3) sobre os títulos a receber em aberto. Sem agendador (BullMQ fora):
 * disparada pela retaguarda (botão "Rodar régua") — o mesmo caminho que um cron chamaria depois.
 *
 *  - etapa devida = `dueDate + offsetDays <= now` e SEM evento anterior daquela etapa no título;
 *  - interrupções (06 §2.3): pago/renegociado/perdida saem sozinhos (o filtro é por status);
 *  - modo `propose` (default do produto): evento `proposed` — nada sai sem aprovação humana;
 *  - modo `auto` (opt-in registrado): envia AGORA e grava `sent`;
 *  - POLÍTICA "PERDIDA" (04 §3.4 / 06 §2.6): a etapa de MAIOR offset positivo é a RECOBRANÇA e
 *    REPETE a cada `offsetDays` dias; completadas `1 + maxRebillings` passagens sem pagamento,
 *    o título vira `written_off_pending` e SAI da régua (aceite 5). Decisão registrada
 *    (24/08/2026): a repetição espaçada pelo próprio offset é a leitura mais simples e auditável
 *    do "1 cobrança + N recobranças" fora da rota.
 */
@Injectable()
export class RunDunningUseCase implements UseCase<RunDunningCommand, DunningRunResult> {
  private readonly logger = new Logger(RunDunningUseCase.name);

  constructor(
    @Inject(DUNNING_RULE_REPOSITORY) private readonly rules: DunningRuleRepositoryPort,
    @Inject(DUNNING_EVENT_REPOSITORY) private readonly events: DunningEventRepositoryPort,
    @Inject(FINANCIAL_TITLE_REPOSITORY) private readonly titles: FinancialTitleRepositoryPort,
    @Inject(BILLING_PAYER_LOOKUP) private readonly payers: BillingPayerLookupPort,
    @Inject(DUNNING_MESSENGER) private readonly messenger: DunningMessengerPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: RunDunningCommand): Promise<DunningRunResult> {
    return this.uow.execute(async () => {
      const rule = await this.rules.getForAccount();
      if (!rule || rule.steps.length === 0) {
        throw new DunningRuleInvalidException('Configure a régua antes de rodá-la.');
      }

      const candidates = (
        await this.titles.list({ direction: 'receivable', status: null })
      ).filter((title) => title.status === 'open' || title.status === 'partial');

      const result: DunningRunResult = { proposed: 0, sent: 0, writtenOffPending: [] };
      const lastAfterStep = [...rule.steps]
        .filter((step) => step.offsetDays > 0)
        .sort((a, b) => b.offsetDays - a.offsetDays)[0];

      for (const title of candidates) {
        const history = await this.events.listByTitle(title.id);
        const fired = (step: DunningStep) =>
          history.filter((event) => event.stepId === step.id || event.offsetDays === step.offsetDays).length;

        // Perdida: recobrança (última etapa pós-vencimento) completou 1+N passagens sem pagamento.
        if (lastAfterStep) {
          const passes = fired(lastAfterStep);
          if (passes >= 1 + rule.maxRebillings) {
            title.flagWrittenOffPending();
            await this.titles.save(title);
            result.writtenOffPending.push(title.id);
            continue; // saiu da régua (aceite 5)
          }
        }

        for (const step of rule.steps) {
          const isRebilling = lastAfterStep && step.id === lastAfterStep.id;
          const alreadyFired = fired(step);
          if (!isRebilling && alreadyFired > 0) {
            continue; // etapa comum dispara uma vez por título
          }
          // Recobrança repete espaçada pelo próprio offset: passagem K é devida em
          // dueDate + offset * (K+1).
          const multiplier = isRebilling ? alreadyFired + 1 : 1;
          const dueAt = title.dueDate.getTime() + step.offsetDays * multiplier * DAY_MS;
          if (dueAt > command.now.getTime()) {
            continue;
          }

          const payer = title.contactId
            ? await this.payers.findByContactId(title.contactId)
            : null;
          const message = renderTemplate(step.template, title, payer?.name ?? 'Cliente');
          const destination =
            step.channel === 'whatsapp' ? (payer?.whatsapp ?? null) : (payer?.email ?? null);

          if (step.mode === 'auto' && destination) {
            await this.messenger.send({ channel: step.channel, to: destination, message });
            await this.events.save(
              DunningEvent.create({
                accountId: command.accountId,
                titleId: title.id,
                stepId: step.id,
                offsetDays: step.offsetDays,
                channel: step.channel,
                renderedMessage: message,
                status: 'sent',
              }),
            );
            result.sent += 1;
          } else {
            // Default do produto: PROPÕE — um humano aprova cada envio (06 aceite 4). Também cai
            // aqui a etapa auto SEM destino (contato sem canal): proposta visível > envio impossível.
            await this.events.save(
              DunningEvent.create({
                accountId: command.accountId,
                titleId: title.id,
                stepId: step.id,
                offsetDays: step.offsetDays,
                channel: step.channel,
                renderedMessage: message,
                status: 'proposed',
              }),
            );
            result.proposed += 1;
          }
        }
      }

      this.logger.log('Régua executada', {
        proposed: result.proposed,
        sent: result.sent,
        perdidas: result.writtenOffPending.length,
      });
      return result;
    });
  }
}

/** [NOME], [VALOR], [VENCIMENTO], [LINK] — as variáveis do 06 §2.3. */
function renderTemplate(template: string, title: FinancialTitle, payerName: string): string {
  return template
    .replaceAll('[NOME]', payerName)
    .replaceAll(
      '[VALOR]',
      title.openAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
    )
    .replaceAll('[VENCIMENTO]', title.dueDate.toLocaleDateString('pt-BR'))
    .replaceAll('[LINK]', '');
}

// ── Aprovação da proposta ────────────────────────────────────────────────────────────────────────

export class ApproveDunningEventCommand {
  constructor(public readonly eventId: string) {}
}

@Injectable()
export class ApproveDunningEventUseCase implements UseCase<
  ApproveDunningEventCommand,
  { id: string; status: string }
> {
  constructor(
    @Inject(DUNNING_EVENT_REPOSITORY) private readonly events: DunningEventRepositoryPort,
    @Inject(FINANCIAL_TITLE_REPOSITORY) private readonly titles: FinancialTitleRepositoryPort,
    @Inject(BILLING_PAYER_LOOKUP) private readonly payers: BillingPayerLookupPort,
    @Inject(DUNNING_MESSENGER) private readonly messenger: DunningMessengerPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: ApproveDunningEventCommand): Promise<{ id: string; status: string }> {
    return this.uow.execute(async () => {
      const event = await this.events.findById(command.eventId);
      if (!event || event.status !== 'proposed') {
        throw new DunningRuleInvalidException('Proposta de cobrança não encontrada ou já tratada.');
      }
      const title = await this.titles.findById(event.titleId);
      const payer = title?.contactId
        ? await this.payers.findByContactId(title.contactId)
        : null;
      const destination =
        event.channel === 'whatsapp' ? (payer?.whatsapp ?? null) : (payer?.email ?? null);
      if (!destination) {
        throw new DunningRuleInvalidException(
          `O contato não tem ${event.channel === 'whatsapp' ? 'WhatsApp' : 'e-mail'} cadastrado.`,
        );
      }
      await this.messenger.send({
        channel: event.channel,
        to: destination,
        message: event.renderedMessage,
      });
      event.markSent();
      await this.events.save(event);
      return { id: event.id, status: event.status };
    });
  }
}
