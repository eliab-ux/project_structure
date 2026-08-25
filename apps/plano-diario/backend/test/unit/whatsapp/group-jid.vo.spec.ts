import { GroupJid } from '../../../src/contexts/whatsapp/domain/value-objects/group-jid.vo';
import { InvalidGroupJidException } from '../../../src/contexts/whatsapp/domain/exceptions/invalid-group-jid.exception';

describe('GroupJid', () => {
  it.each([
    '120363021234567890@g.us',
    '5511999999999-1234567890@g.us',
    '12345@g.us',
  ])('aceita JID de grupo: %s', (jid) => {
    expect(GroupJid.create(jid).value).toBe(jid);
  });

  it('remove espaços das pontas', () => {
    expect(GroupJid.create('  120363021234567890@g.us  ').value).toBe('120363021234567890@g.us');
  });

  it('RECUSA JID de contato individual', () => {
    // O erro que mais importa evitar: a leitura diária iria para o privado de alguém.
    expect(() => GroupJid.create('5511999999999@s.whatsapp.net')).toThrow(InvalidGroupJidException);
  });

  it.each([
    ['vazio', ''],
    ['sem domínio', '120363021234567890'],
    ['domínio errado', '120363021234567890@c.us'],
    ['broadcast', 'status@broadcast'],
    ['com letras', 'abc123@g.us'],
    ['só o sufixo', '@g.us'],
  ])('recusa %s', (_caso, jid) => {
    expect(() => GroupJid.create(jid)).toThrow(InvalidGroupJidException);
  });

  it('não vaza o valor recebido na mensagem de erro', () => {
    expect(() => GroupJid.create('<script>alert(1)</script>')).toThrow(
      'Identificador de grupo do WhatsApp inválido',
    );
  });

  it('isValid não lança', () => {
    expect(GroupJid.isValid('120363021234567890@g.us')).toBe(true);
    expect(GroupJid.isValid('5511999999999@s.whatsapp.net')).toBe(false);
  });
});
