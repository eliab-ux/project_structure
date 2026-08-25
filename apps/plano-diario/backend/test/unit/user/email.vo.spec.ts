import { InvalidEmailException } from '../../../src/contexts/user/domain/exceptions/invalid-email.exception';
import { Email } from '../../../src/contexts/user/domain/value-objects/email.vo';

describe('Email (Value Object)', () => {
  it('normaliza para lowercase e remove espaços das pontas', () => {
    expect(Email.create('  Eliab@Exemplo.COM  ').value).toBe('eliab@exemplo.com');
  });

  it.each([
    ['sem arroba', 'eliabexemplo.com'],
    ['sem domínio', 'eliab@'],
    ['sem TLD', 'eliab@exemplo'],
    ['com espaço interno', 'eli ab@exemplo.com'],
    ['vazio', ''],
  ])('rejeita e-mail %s', (_caso, valor) => {
    expect(() => Email.create(valor)).toThrow(InvalidEmailException);
  });

  it('rejeita e-mail acima de 255 caracteres', () => {
    const longo = `${'a'.repeat(250)}@exemplo.com`;
    expect(() => Email.create(longo)).toThrow(InvalidEmailException);
  });

  it('não vaza o valor recebido na mensagem de erro', () => {
    expect(() => Email.create('payload-malicioso<script>')).toThrow('E-mail inválido');
  });

  it('considera iguais dois e-mails que diferem só por caixa', () => {
    expect(Email.create('A@b.com').equals(Email.create('a@b.com'))).toBe(true);
  });
});
