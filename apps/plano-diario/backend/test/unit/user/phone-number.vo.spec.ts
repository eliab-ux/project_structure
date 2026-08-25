import { InvalidPhoneNumberException } from '../../../src/contexts/user/domain/exceptions/invalid-phone-number.exception';
import { PhoneNumber } from '../../../src/contexts/user/domain/value-objects/phone-number.vo';

describe('PhoneNumber', () => {
  it.each([
    ['com máscara', '(11) 91234-5678'],
    ['só dígitos', '11912345678'],
    ['com país e +', '+55 11 91234-5678'],
    ['com país sem +', '5511912345678'],
    ['com espaços sobrando', '  (11) 9 1234-5678  '],
  ])('normaliza para E.164 sem + (%s)', (_caso, entrada) => {
    // Todas as formas que o usuário pode digitar terminam no MESMO valor — é ele que a Evolution
    // recebe e é por ele que a recuperação de senha acha o destinatário.
    expect(PhoneNumber.create(entrada).value).toBe('5511912345678');
  });

  it.each([
    ['sem DDD', '912345678'],
    ['vazio', ''],
    ['só letras', 'não tenho'],
    ['DDD inválido', '(01) 91234-5678'],
    ['fixo de 8 dígitos', '(11) 3234-5678'],
    ['curto demais', '119123'],
    ['longo demais', '5511912345678901234'],
  ])('rejeita %s', (_caso, entrada) => {
    expect(() => PhoneNumber.create(entrada)).toThrow(InvalidPhoneNumberException);
  });

  it('exige o nono dígito no celular brasileiro', () => {
    // 10 dígitos com DDD válido é telefone fixo: não recebe WhatsApp.
    expect(() => PhoneNumber.create('1132345678')).toThrow(InvalidPhoneNumberException);
    expect(PhoneNumber.create('11912345678').value).toBe('5511912345678');
  });

  it('aceita número estrangeiro em E.164', () => {
    // +351 (Portugal) — o sistema não é exclusivo do Brasil.
    expect(PhoneNumber.create('+351 912 345 678').value).toBe('351912345678');
  });

  it('formata como o usuário reconhece', () => {
    expect(PhoneNumber.create('11912345678').formatted).toBe('(11) 91234-5678');
    expect(PhoneNumber.create('+351912345678').formatted).toBe('+351912345678');
  });

  it('mascara escondendo o miolo do número', () => {
    const masked = PhoneNumber.create('11912345678').masked;

    expect(masked).toBe('(11) 9****-5678');
    // O que não pode: a máscara mostrar o número inteiro.
    expect(masked).not.toContain('1234');
  });

  it('dois números iguais escritos de formas diferentes são o MESMO value object', () => {
    // Igualdade estrutural do ValueObject: é o que impede duas contas para o mesmo WhatsApp
    // parecerem distintas só pela formatação.
    expect(PhoneNumber.create('(11) 91234-5678').equals(PhoneNumber.create('5511912345678'))).toBe(
      true,
    );
  });
});
