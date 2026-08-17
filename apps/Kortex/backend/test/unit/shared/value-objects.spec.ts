import { Email } from '../../../src/shared/domain/value-objects/email.vo';
import { PhoneE164 } from '../../../src/shared/domain/value-objects/phone-e164.vo';
import { Money } from '../../../src/shared/domain/value-objects/money.vo';
import { TimeOfDay } from '../../../src/shared/domain/value-objects/time-of-day.vo';
import { PlainPassword } from '../../../src/shared/domain/value-objects/plain-password.vo';
import { InvalidValueException } from '../../../src/shared/domain/exceptions/invalid-value.exception';

describe('Email', () => {
  it('normaliza caixa e espaços — senão o mesmo login vira duas contas', () => {
    expect(Email.create('  Bia@CorteCeres.COM.BR ').value).toBe('bia@corteceres.com.br');
  });

  it.each(['sem-arroba', 'a@b', '@dominio.com', ''])('recusa %p', (invalid) => {
    expect(() => Email.create(invalid)).toThrow(InvalidValueException);
  });

  it('não repete o valor recusado na mensagem', () => {
    expect(() => Email.create('nao-e-email')).toThrow('E-mail inválido.');
  });
});

describe('PhoneE164', () => {
  it.each([
    ['(62) 9 9870-8893', '+5562998708893'],
    ['62998708893', '+5562998708893'],
    ['5562998708893', '+5562998708893'],
    ['+55 62 99870-8893', '+5562998708893'],
    ['6232345678', '+556232345678'],
  ])('normaliza %p para %p', (input, expected) => {
    expect(PhoneE164.create(input).value).toBe(expected);
  });

  it('expõe os dígitos sem o + para a Evolution API', () => {
    expect(PhoneE164.create('(62) 9 9870-8893').digits).toBe('5562998708893');
  });

  it.each(['', '123', 'abc', '999'])('recusa %p', (invalid) => {
    expect(() => PhoneE164.create(invalid)).toThrow(InvalidValueException);
  });
});

describe('Money', () => {
  it('guarda centavos inteiros', () => {
    expect(Money.fromCents(8500).cents).toBe(8500);
  });

  it.each([0, -1, 8500.5, 2_000_000])('recusa %p', (invalid) => {
    expect(() => Money.fromCents(invalid)).toThrow(InvalidValueException);
  });

  it('multiplica sem ponto flutuante — 3h de R$ 85,00 dão exatamente R$ 255,00', () => {
    expect(Money.fromCents(8500).multiply(3).cents).toBe(25500);
  });
});

describe('TimeOfDay', () => {
  it('aceita HH:MM e o HH:MM:SS que o Postgres devolve', () => {
    expect(TimeOfDay.create('07:00').value).toBe('07:00');
    expect(TimeOfDay.create('11:30:00').value).toBe('11:30');
  });

  it('compara por minutos, não por string', () => {
    expect(TimeOfDay.create('09:00').isBefore(TimeOfDay.create('11:30'))).toBe(true);
    expect(TimeOfDay.create('13:00').isBefore(TimeOfDay.create('11:30'))).toBe(false);
  });

  it.each(['24:00', '7:00', '11:60', 'meio-dia', ''])('recusa %p', (invalid) => {
    expect(() => TimeOfDay.create(invalid)).toThrow(InvalidValueException);
  });
});

describe('PlainPassword', () => {
  it('exige pelo menos 8 caracteres', () => {
    expect(() => PlainPassword.create('1234567')).toThrow(InvalidValueException);
    expect(() => PlainPassword.create('12345678')).not.toThrow();
  });

  it('recusa acima do limite do bcrypt (72 bytes)', () => {
    expect(() => PlainPassword.create('a'.repeat(73))).toThrow(InvalidValueException);
  });

  it('não vaza o valor em log nem em serialização', () => {
    const password = PlainPassword.create('senha-secreta-123');
    expect(JSON.stringify({ password })).not.toContain('senha-secreta-123');
    expect(String(password)).not.toContain('senha-secreta-123');
    expect(`${password}`).toBe('[senha omitida]');
  });

  it('entrega o valor apenas por use()', () => {
    expect(PlainPassword.create('senha-secreta-123').use((plain) => plain)).toBe(
      'senha-secreta-123',
    );
  });
});
