import { User } from '../../../src/contexts/user/domain/entities/user.entity';
import { AccountId } from '../../../src/contexts/account/domain/value-objects/account-id.vo';
import { Email } from '../../../src/shared/domain/value-objects/email.vo';
import { PhoneE164 } from '../../../src/shared/domain/value-objects/phone-e164.vo';
import { InvalidValueException } from '../../../src/shared/domain/exceptions/invalid-value.exception';
import { assertUserRole } from '../../../src/contexts/user/domain/value-objects/user-role.vo';
import { UserDto } from '../../../src/contexts/user/application/dto/user.dto';

const VALID_HASH = '$2a$12$abcdefghijklmnopqrstuvABCDEFGHIJKLMNOPQRSTUVWXYZ01234';

function build(overrides: Partial<Parameters<typeof User.create>[0]> = {}): User {
  return User.create({
    accountId: AccountId.create(),
    name: 'Cristiano Moreira dos Reis',
    email: Email.create('cristiano@corteceres.com.br'),
    phone: PhoneE164.create('(62) 9 9870-8893'),
    passwordHash: VALID_HASH,
    role: 'modelista',
    ...overrides,
  });
}

describe('User', () => {
  it('nasce ativo e obrigado a trocar a senha', () => {
    const user = build();
    expect(user.isActive).toBe(true);
    expect(user.mustChangePassword).toBe(true);
    expect(user.canAuthenticate()).toBe(true);
  });

  it('permite dispensar a troca só quando quem escolheu a senha foi o próprio usuário', () => {
    expect(build({ mustChangePassword: false }).mustChangePassword).toBe(false);
  });

  it('recusa senha em claro no lugar do hash — o pior bug possível aqui', () => {
    expect(() => build({ passwordHash: 'minha-senha-123' })).toThrow(InvalidValueException);
  });

  it('recusa nome curto demais', () => {
    expect(() => build({ name: 'A' })).toThrow(InvalidValueException);
  });

  it('recusa papel desconhecido', () => {
    expect(() => assertUserRole('gerente')).toThrow(InvalidValueException);
  });

  it('encerra o acesso ao ser desligado, sem apagar o registro', () => {
    const user = build();
    user.deactivate();
    expect(user.isActive).toBe(false);
    expect(user.canAuthenticate()).toBe(false);
    expect(user.id.value).toBeTruthy();
  });

  it('limpa a obrigação de trocar quando o próprio usuário troca a senha', () => {
    const user = build();
    user.changePassword(VALID_HASH.replace('01234', '43210'));
    expect(user.mustChangePassword).toBe(false);
  });

  it('registra o último acesso', () => {
    const user = build();
    expect(user.lastLoginAt).toBeNull();
    user.registerLogin(new Date('2026-08-14T07:12:00.000Z'));
    expect(user.lastLoginAt?.toISOString()).toBe('2026-08-14T07:12:00.000Z');
  });
});

describe('UserDto', () => {
  it('NÃO expõe o hash da senha — ausência intencional, verificada aqui', () => {
    const dto = UserDto.fromDomain(build());
    const serialized = JSON.stringify(dto);

    expect(Object.keys(dto)).not.toContain('passwordHash');
    expect(serialized).not.toContain(VALID_HASH);
    expect(serialized).not.toContain('$2a$');
  });

  it('expõe exatamente os campos da tela de Equipe, e nada além', () => {
    expect(Object.keys(UserDto.fromDomain(build())).sort()).toEqual([
      'email',
      'id',
      'isActive',
      'lastLoginAt',
      'mustChangePassword',
      'name',
      'phone',
      'role',
    ]);
  });
});
