import { DeleteContactUseCase } from '../../../src/contexts/audience/application/use-cases/delete-contact/delete-contact.use-case';
import { DeleteContactCommand } from '../../../src/contexts/audience/application/use-cases/delete-contact/delete-contact.command';
import { ContactRepositoryPort } from '../../../src/contexts/audience/application/ports/output/contact-repository.port';
import { ContactUsagePort } from '../../../src/contexts/audience/application/ports/output/contact-usage.port';
import { Contact } from '../../../src/contexts/audience/domain/entities/contact.entity';
import { ContactId } from '../../../src/contexts/audience/domain/value-objects/contact-id.vo';
import { ContactNotFoundException } from '../../../src/contexts/audience/domain/exceptions/contact-not-found.exception';
import { ContactNotDeletableException } from '../../../src/contexts/audience/domain/exceptions/contact-not-deletable.exception';
import { RecordAuditLogUseCase } from '../../../src/contexts/audit/application/use-cases/record-audit-log.use-case';
import { AuditAction } from '../../../src/contexts/audit/domain/value-objects/audit-action.vo';
import { PhoneE164 } from '../../../src/shared/domain/value-objects/phone-e164.vo';

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const CONTACT_ID = 'dddddddd-1111-4111-8111-111111111111';
const CHANNEL_ID = 'cccccccc-1111-4111-8111-111111111111';
const USER_ID = 'aaaaaaaa-1111-4111-8111-111111111111';

function contact(): Contact {
  return Contact.reconstitute({
    id: ContactId.from(CONTACT_ID),
    accountId: ACCOUNT_ID,
    phone: PhoneE164.create('11988887777'),
    name: 'Maria',
    firstName: 'Maria',
    tags: ['Brasilia'],
    currentChannelId: CHANNEL_ID,
    active: true,
    optedOutAt: null,
    contactImportId: null,
    createdAt: new Date('2026-07-01T00:00:00Z'),
  });
}

describe('DeleteContactUseCase', () => {
  let contacts: jest.Mocked<ContactRepositoryPort>;
  let usage: jest.Mocked<ContactUsagePort>;
  let audit: { execute: jest.Mock };
  let useCase: DeleteContactUseCase;

  const command = new DeleteContactCommand(ACCOUNT_ID, CONTACT_ID, USER_ID, '203.0.113.7');

  beforeEach(() => {
    contacts = {
      findById: jest.fn(async () => contact()),
      delete: jest.fn(async () => undefined),
    } as unknown as jest.Mocked<ContactRepositoryPort>;
    usage = {
      countDispatches: jest.fn(async () => 0),
    } as unknown as jest.Mocked<ContactUsagePort>;
    audit = { execute: jest.fn() };

    useCase = new DeleteContactUseCase(contacts, usage, audit as unknown as RecordAuditLogUseCase);
  });

  it('apaga um contato que nunca recebeu nada', async () => {
    await useCase.execute(command);

    expect(contacts.delete).toHaveBeenCalledTimes(1);
    expect(contacts.delete.mock.calls[0][0].value).toBe(CONTACT_ID);
  });

  it('registra na trilha ANTES de apagar, com o telefone mascarado', async () => {
    await useCase.execute(command);

    const [entry] = audit.execute.mock.calls[0];
    expect(entry.action).toBe(AuditAction.CONTACT_DELETED);
    expect(entry.entityId).toBe(CONTACT_ID);
    // Depois do delete não há de onde ler nome e tags, e "um contato foi excluído" não responde nada.
    expect(entry.payload.name).toBe('Maria');
    expect(entry.payload.tags).toEqual(['Brasilia']);
    // Mascarado: a trilha diz QUAL contato sem imprimir o número (§16).
    expect(entry.payload.phoneMasked).not.toContain('88887777');
    expect(JSON.stringify(entry.payload)).not.toContain('+5511988887777');
  });

  it('recusa quem já aparece em um envio, dizendo quantos e o que fazer no lugar', async () => {
    usage.countDispatches.mockResolvedValue(3);

    await expect(useCase.execute(command)).rejects.toThrow(ContactNotDeletableException);
    // O registro do envio é a prova do que foi enviado, para quem e quando.
    expect(contacts.delete).not.toHaveBeenCalled();
    expect(audit.execute).not.toHaveBeenCalled();

    await expect(useCase.execute(command)).rejects.toThrow(/3 envio/);
  });

  it('recusa quem pediu para sair — apagar tornaria o opt-out reversível', async () => {
    const optedOut = contact();
    optedOut.optOut('MANUAL', USER_ID);
    contacts.findById.mockResolvedValue(optedOut);

    await expect(useCase.execute(command)).rejects.toThrow(ContactNotDeletableException);
    // A próxima importação da mesma planilha traria o número de volta sem a marca, e alguém que
    // pediu para ser deixado em paz voltaria a receber mensagens.
    expect(contacts.delete).not.toHaveBeenCalled();
  });

  it('a checagem de opt-out vem antes da de envios: o motivo mostrado é o que não muda', async () => {
    const optedOut = contact();
    optedOut.optOut('MANUAL', USER_ID);
    contacts.findById.mockResolvedValue(optedOut);
    usage.countDispatches.mockResolvedValue(10);

    await expect(useCase.execute(command)).rejects.toThrow(/pediu para sair/);
  });

  it('404 quando o contato não existe — inclusive o de outra conta, invisível pelo filtro', async () => {
    contacts.findById.mockResolvedValue(null);

    await expect(useCase.execute(command)).rejects.toThrow(ContactNotFoundException);
    expect(contacts.delete).not.toHaveBeenCalled();
  });
});
