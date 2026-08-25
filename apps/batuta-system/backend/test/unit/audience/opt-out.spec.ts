import {
  OPT_OUT_CONFIRMATION_MESSAGE,
  isOptOutRequest,
} from '../../../src/contexts/audience/domain/services/opt-out-keywords';
import { ChannelRepositoryPort } from '../../../src/contexts/channel/application/ports/output/channel-repository.port';
import { Channel } from '../../../src/contexts/channel/domain/entities/channel.entity';
import { QuotaBand } from '../../../src/contexts/channel/domain/value-objects/quota-band.vo';
import { ContactRepositoryPort } from '../../../src/contexts/audience/application/ports/output/contact-repository.port';
import { Contact } from '../../../src/contexts/audience/domain/entities/contact.entity';
import { HandleInboundOptOutUseCase } from '../../../src/contexts/audience/application/use-cases/handle-inbound-opt-out/handle-inbound-opt-out.use-case';
import { HandleInboundOptOutCommand } from '../../../src/contexts/audience/application/use-cases/handle-inbound-opt-out/handle-inbound-opt-out.command';
import { RecordAuditLogUseCase } from '../../../src/contexts/audit/application/use-cases/record-audit-log.use-case';
import { AuditActorType } from '../../../src/contexts/audit/domain/value-objects/audit-action.vo';
import { EventPublisherPort } from '../../../src/infrastructure/persistence/ports/event-publisher.port';
import { WhatsAppGatewayPort } from '../../../src/infrastructure/whatsapp/ports/whatsapp-gateway.port';
import { PhoneE164 } from '../../../src/shared/domain/value-objects/phone-e164.vo';

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const CHANNEL_ID = 'aaaaaaaa-1111-4111-8111-111111111111';

describe('isOptOutRequest (§6.5)', () => {
  it('matches every keyword the spec names', () => {
    for (const keyword of ['PARAR', 'SAIR', 'CANCELAR', 'DESCADASTRAR', 'REMOVER']) {
      expect(isOptOutRequest(keyword)).toBe(true);
    }
  });

  it('is case and accent insensitive', () => {
    expect(isOptOutRequest('parar')).toBe(true);
    expect(isOptOutRequest('Parar')).toBe(true);
    expect(isOptOutRequest('PARÁR')).toBe(true);
    expect(isOptOutRequest('  sair  ')).toBe(true);
  });

  it('ignores punctuation and emoji around the word', () => {
    expect(isOptOutRequest('PARAR!!!')).toBe(true);
    expect(isOptOutRequest('sair.')).toBe(true);
    expect(isOptOutRequest('(cancelar)')).toBe(true);
    expect(isOptOutRequest('parar 🙏')).toBe(true);
  });

  it('accepts the common courtesy shapes', () => {
    expect(isOptOutRequest('quero sair')).toBe(true);
    expect(isOptOutRequest('favor parar')).toBe(true);
    expect(isOptOutRequest('me remover')).toBe(true);
  });

  describe('does NOT match a sentence that merely contains the word', () => {
    it.each([
      'não quero parar de receber',
      'vou cancelar meu plano de internet',
      'pode remover o item do pedido?',
      'preciso sair mais cedo hoje',
      'obrigado, vou sair de férias amanhã',
    ])('%s', (body) => {
      // A false positive irreversibly deletes a real contact — the asymmetry justifies strictness.
      expect(isOptOutRequest(body)).toBe(false);
    });
  });

  it('does not match an empty or unrelated message', () => {
    expect(isOptOutRequest('')).toBe(false);
    expect(isOptOutRequest(null)).toBe(false);
    expect(isOptOutRequest('bom dia')).toBe(false);
    expect(isOptOutRequest('👍')).toBe(false);
  });
});

describe('HandleInboundOptOutUseCase', () => {
  let contacts: jest.Mocked<ContactRepositoryPort>;
  let channels: jest.Mocked<ChannelRepositoryPort>;
  let gateway: jest.Mocked<WhatsAppGatewayPort>;
  let events: jest.Mocked<EventPublisherPort>;
  let audit: jest.Mocked<Pick<RecordAuditLogUseCase, 'execute'>>;
  let useCase: HandleInboundOptOutUseCase;
  let contact: Contact;

  function connectedChannel(): Channel {
    const channel = Channel.create({
      accountId: ACCOUNT_ID,
      label: 'Chip',
      phone: PhoneE164.create('1133334444'),
      quota: QuotaBand.create(20, 150),
    });
    channel.markAwaitingQr();
    channel.markConnected();
    channel.pullDomainEvents();
    return channel;
  }

  beforeEach(() => {
    contact = Contact.create({
      accountId: ACCOUNT_ID,
      phone: PhoneE164.create('11999998888'),
      name: 'Maria',
      channelId: CHANNEL_ID,
    });

    contacts = {
      findById: jest.fn(),
      findByPhone: jest.fn(async () => contact),
      findManyByPhones: jest.fn(),
      list: jest.fn(),
      save: jest.fn(async (c) => c),
      saveMany: jest.fn(),
      countByChannel: jest.fn(),
      listByChannel: jest.fn(),
      countByChannelId: jest.fn(),
    } as unknown as jest.Mocked<ContactRepositoryPort>;

    channels = {
      findById: jest.fn(async () => connectedChannel()),
      findByPhone: jest.fn(),
      listByAccount: jest.fn(),
      listConnected: jest.fn(),
      save: jest.fn(),
      listAllForDailyReview: jest.fn(),
    } as unknown as jest.Mocked<ChannelRepositoryPort>;

    gateway = {
      sendText: jest.fn(async () => ({ providerMessageId: 'msg-1' })),
      createInstance: jest.fn(),
      getQrCode: jest.fn(),
      getConnectionState: jest.fn(),
      logout: jest.fn(),
      deleteInstance: jest.fn(),
      sendMedia: jest.fn(),
      sendDocument: jest.fn(),
    } as unknown as jest.Mocked<WhatsAppGatewayPort>;

    events = {
      publish: jest.fn(),
      publishAll: jest.fn(),
    } as unknown as jest.Mocked<EventPublisherPort>;
    audit = { execute: jest.fn() };

    useCase = new HandleInboundOptOutUseCase(
      contacts,
      channels,
      gateway,
      events,
      audit as unknown as RecordAuditLogUseCase,
    );
  });

  function command(body: string): HandleInboundOptOutCommand {
    return new HandleInboundOptOutCommand(ACCOUNT_ID, '5511999998888', body, CHANNEL_ID);
  }

  it('opts the contact out and confirms, through the SAME chip they know', async () => {
    const result = await useCase.execute(command('PARAR'));

    expect(result).toEqual({ detected: true, optedOut: true, confirmationSent: true });
    expect(contact.hasOptedOut).toBe(true);
    expect(gateway.sendText).toHaveBeenCalledWith(
      expect.objectContaining({ toDigits: '5511999998888', text: OPT_OUT_CONFIRMATION_MESSAGE }),
    );
  });

  it('records it as a SYSTEM action — the contact asked, nobody decided', async () => {
    await useCase.execute(command('sair'));

    expect(audit.execute).toHaveBeenCalledWith(
      expect.objectContaining({ actorType: AuditActorType.SYSTEM, actorId: null }),
    );
  });

  it('never puts the message body or the full phone in the trail', async () => {
    await useCase.execute(command('PARAR'));

    const recorded = JSON.stringify(audit.execute.mock.calls);
    expect(recorded).not.toContain('5511999998888');
    expect(recorded).toContain('+5511*****8888');
  });

  it('does nothing for a normal message', async () => {
    const result = await useCase.execute(command('bom dia, tudo bem?'));

    expect(result.detected).toBe(false);
    expect(contacts.save).not.toHaveBeenCalled();
    expect(gateway.sendText).not.toHaveBeenCalled();
  });

  it('ignores a keyword from a number that is not in the base', async () => {
    contacts.findByPhone.mockResolvedValue(null);

    const result = await useCase.execute(command('PARAR'));

    expect(result).toEqual({ detected: true, optedOut: false, confirmationSent: false });
    expect(gateway.sendText).not.toHaveBeenCalled();
  });

  it('does not send a SECOND confirmation to someone already out', async () => {
    contact.optOut('MANUAL', 'user-1');
    contact.pullDomainEvents();

    const result = await useCase.execute(command('PARAR'));

    expect(result.optedOut).toBe(true);
    expect(result.confirmationSent).toBe(false);
    // A second message to someone who asked for none would be the exact wrong outcome.
    expect(gateway.sendText).not.toHaveBeenCalled();
  });

  it('KEEPS the opt-out when the confirmation fails to send', async () => {
    gateway.sendText.mockRejectedValue(new Error('instância caiu'));

    const result = await useCase.execute(command('PARAR'));

    // Being removed matters more than being told.
    expect(result.optedOut).toBe(true);
    expect(result.confirmationSent).toBe(false);
    expect(contact.hasOptedOut).toBe(true);
  });

  it('does not confirm through a channel that cannot send', async () => {
    const channel = connectedChannel();
    channel.markDisconnected();
    channels.findById.mockResolvedValue(channel);

    const result = await useCase.execute(command('PARAR'));

    expect(result.optedOut).toBe(true);
    expect(result.confirmationSent).toBe(false);
  });

  it('ignores an unparseable sender', async () => {
    const result = await useCase.execute(
      new HandleInboundOptOutCommand(ACCOUNT_ID, 'not-a-phone', 'PARAR', CHANNEL_ID),
    );

    expect(result.optedOut).toBe(false);
    expect(contacts.save).not.toHaveBeenCalled();
  });
});
