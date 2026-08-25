import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { EmailService } from '@infrastructure/messaging/email/email.service';
import {
  RESELLER_REPOSITORY,
  ResellerRepositoryPort,
} from '../application/ports/output/reseller-repository.port';
import {
  USER_REPOSITORY,
  UserRepositoryPort,
} from '@contexts/user/application/ports/output/user-repository.port';
import { ResellerId } from '../domain/value-objects/reseller-id.vo';
import { UserId } from '@contexts/user/domain/value-objects/user-id.vo';
import { ResellerApprovedEvent } from '../domain/events/reseller-approved.event';
import { ResellerRejectedEvent } from '../domain/events/reseller-rejected.event';
import { ResellerRegisteredEvent } from '../domain/events/reseller-registered.event';

const DEFAULT_FRONTEND = 'https://kazatem.shop';
const DEFAULT_SUPPORT_EMAIL = 'suporte@kazatem.shop';

@Injectable()
export class ResellerEmailEventHandlers {
  private readonly logger = new Logger(ResellerEmailEventHandlers.name);
  private readonly frontendUrl: string;
  private readonly supportEmail: string;

  constructor(
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    @Inject(RESELLER_REPOSITORY)
    private readonly resellerRepository: ResellerRepositoryPort,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
  ) {
    const baseUrl = this.configService.get<string>('FRONTEND_URL')?.trim() ?? DEFAULT_FRONTEND;
    this.frontendUrl = baseUrl.replace(/\/*$/, '');
    this.supportEmail = this.configService.get<string>('SUPPORT_EMAIL') ?? DEFAULT_SUPPORT_EMAIL;
  }

  @OnEvent('reseller.registered')
  async onRegistered(event: ResellerRegisteredEvent): Promise<void> {
    const pair = await this.loadContact(event.resellerId);
    if (!pair) {
      return;
    }

    const { reseller, user } = pair;
    const subject = 'Cadastro Recebido — Kaza Tem Imports';
    const html = `<p>Olá, ${reseller.fullName}!</p>
<p>Recebemos seu cadastro para se tornar revendedor Kaza Tem Imports.</p>
<p>Nosso time está analisando suas informações e você receberá uma resposta em até 24 horas úteis.</p>
<p>Qualquer dúvida, entre em contato conosco pelo email: <a href="mailto:${this.supportEmail}">${this.supportEmail}</a></p>
<p>Atenciosamente,<br/>Equipe Kaza Tem Imports</p>`;
    const text = [
      `Olá, ${reseller.fullName}!`,
      '',
      'Recebemos seu cadastro para se tornar revendedor Kaza Tem Imports.',
      'Nosso time está analisando suas informações e você receberá uma resposta em até 24 horas úteis.',
      `Qualquer dúvida, entre em contato conosco pelo email: ${this.supportEmail}`,
      '',
      'Atenciosamente,',
      'Equipe Kaza Tem Imports',
    ].join('\n');

    await this.sendEmail(user.email.value, subject, html, text);
  }

  @OnEvent('reseller.approved')
  async onApproved(event: ResellerApprovedEvent): Promise<void> {
    const pair = await this.loadContact(event.resellerId);
    if (!pair) {
      return;
    }

    const { reseller, user } = pair;
    const uniqueCode = reseller.uniqueLink.value;
    const landingUrl = reseller.uniqueLink.getFullUrl(this.frontendUrl);
    const subscriptionUrl = this.resolveFrontendPath('/reseller/subscription/create');
    const subscriptionLink = `${subscriptionUrl}?code=${encodeURIComponent(uniqueCode)}`;

    const subject = '🎉 Cadastro Aprovado — Bem-vindo à Kaza Tem!';
    const html = `<p>Olá, ${reseller.fullName}!</p>
<p>Parabéns! Seu cadastro foi aprovado! 🎉</p>
<p>Seu código de revendedor é: <strong>${uniqueCode}</strong></p>
<p>Visite sua página exclusiva: <a href="${landingUrl}">${landingUrl}</a></p>
<p>Para começar a vender, crie sua assinatura mensal (R$ 9,90/mês):<br/><a href="${subscriptionLink}">${subscriptionLink}</a></p>
<p>Após ativar a assinatura, você terá acesso a:</p>
<ul>
  <li>Painel de revendedor</li>
  <li>Links personalizados para divulgação</li>
  <li>Acompanhamento de comissões</li>
  <li>Materiais de marketing exclusivos</li>
</ul>
<p>Qualquer dúvida, estamos à disposição em <a href="mailto:${this.supportEmail}">${this.supportEmail}</a></p>
<p>Atenciosamente,<br/>Equipe Kaza Tem Imports</p>`;
    const text = [
      `Olá, ${reseller.fullName}!`,
      '',
      'Parabéns! Seu cadastro foi aprovado! 🎉',
      `Seu código de revendedor é: ${uniqueCode}`,
      `Visite sua página exclusiva: ${landingUrl}`,
      '',
      'Para começar a vender, crie sua assinatura mensal (R$ 9,90/mês):',
      subscriptionLink,
      '',
      'Após ativar a assinatura, você terá acesso a:',
      '- Painel de revendedor',
      '- Links personalizados para divulgação',
      '- Acompanhamento de comissões',
      '- Materiais de marketing exclusivos',
      '',
      `Qualquer dúvida, estamos à disposição em ${this.supportEmail}`,
      '',
      'Atenciosamente,',
      'Equipe Kaza Tem Imports',
    ].join('\n');

    await this.sendEmail(user.email.value, subject, html, text);
  }

  @OnEvent('reseller.rejected')
  async onRejected(event: ResellerRejectedEvent): Promise<void> {
    const pair = await this.loadContact(event.resellerId);
    if (!pair) {
      return;
    }

    const { reseller, user } = pair;
    const subject = 'Cadastro Não Aprovado — Kaza Tem Imports';
    const html = `<p>Olá, ${reseller.fullName},</p>
<p>Infelizmente seu cadastro não foi aprovado neste momento.</p>
<p>Motivo: ${event.reason}</p>
<p>Se você acredita que houve algum erro ou deseja esclarecer dúvidas, entre em contato conosco: <a href="mailto:${this.supportEmail}">${this.supportEmail}</a></p>
<p>Atenciosamente,<br/>Equipe Kaza Tem Imports</p>`;
    const text = [
      `Olá, ${reseller.fullName},`,
      '',
      'Infelizmente seu cadastro não foi aprovado neste momento.',
      `Motivo: ${event.reason}`,
      '',
      `Se você acredita que houve algum erro ou deseja esclarecer dúvidas, entre em contato conosco: ${this.supportEmail}`,
      '',
      'Atenciosamente,',
      'Equipe Kaza Tem Imports',
    ].join('\n');

    await this.sendEmail(user.email.value, subject, html, text);
  }

  private async loadContact(resellerId: string) {
    try {
      const reseller = await this.resellerRepository.findById(ResellerId.from(resellerId));
      if (!reseller) {
        this.logger.warn(`Revendedor ${resellerId} não encontrado para envio de email`);
        return null;
      }

      const user = await this.userRepository.findById(UserId.from(reseller.userId));
      if (!user) {
        this.logger.warn(`Usuário ${reseller.userId} não encontrado para envio de email`);
        return null;
      }

      return { reseller, user };
    } catch (error) {
      this.logger.error('Erro ao carregar dados para email de revendedor', error as Error);
      return null;
    }
  }

  private resolveFrontendPath(path: string) {
    const trimmed = path.replace(/^\/*/, '');
    return `${this.frontendUrl}/${trimmed}`;
  }

  private async sendEmail(to: string, subject: string, html: string, text: string) {
    try {
      await this.emailService.sendMail(to, subject, html, text);
    } catch (error) {
      this.logger.error(`Erro ao enviar email para ${to}`, error as Error);
    }
  }
}
