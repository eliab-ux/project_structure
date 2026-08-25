import { User } from '../../../src/contexts/user/domain/entities/user.entity';
import { UserRegisteredEvent } from '../../../src/contexts/user/domain/events/user-registered.event';
import { InvalidUserNameException } from '../../../src/contexts/user/domain/exceptions/invalid-user-name.exception';
import { Email } from '../../../src/contexts/user/domain/value-objects/email.vo';
import { PhoneNumber } from '../../../src/contexts/user/domain/value-objects/phone-number.vo';
import { UserRole } from '../../../src/contexts/user/domain/value-objects/user-role.vo';

const email = () => Email.create('eliab@exemplo.com');
const phone = () => PhoneNumber.create('(11) 91234-5678');

describe('User (Aggregate Root)', () => {
  it('registra usuário ativo com papel user e emite UserRegisteredEvent', () => {
    const user = User.register(email(), 'Eliab Caetano', 'hash-fake', phone());

    expect(user.isActive).toBe(true);
    expect(user.role).toBe(UserRole.USER);
    expect(user.canAuthenticate).toBe(true);

    const events = user.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(UserRegisteredEvent);
    expect((events[0] as UserRegisteredEvent).email).toBe('eliab@exemplo.com');
  });

  it('remove espaços das pontas do nome', () => {
    expect(User.register(email(), '  Eliab  ', 'h', phone()).name).toBe('Eliab');
  });

  it.each([
    ['curto', 'E'],
    ['vazio', '   '],
    ['longo', 'a'.repeat(121)],
  ])('rejeita nome %s', (_caso, nome) => {
    expect(() => User.register(email(), nome, 'h', phone())).toThrow(InvalidUserNameException);
  });

  it('conta desativada não pode autenticar', () => {
    const user = User.register(email(), 'Eliab Caetano', 'h', phone());
    user.deactivate();
    expect(user.canAuthenticate).toBe(false);
  });

  it('changePassword troca o hash e atualiza updatedAt', () => {
    const user = User.register(email(), 'Eliab Caetano', 'hash-antigo', phone());
    const antes = user.updatedAt.getTime();
    jest.spyOn(Date, 'now').mockReturnValue(antes + 5_000);

    user.changePassword('hash-novo');

    expect(user.passwordHash).toBe('hash-novo');
    expect(user.updatedAt.getTime()).toBeGreaterThanOrEqual(antes);
    jest.restoreAllMocks();
  });

  it('pullDomainEvents esvazia a fila (evita republicar o mesmo evento)', () => {
    const user = User.register(email(), 'Eliab Caetano', 'h', phone());
    expect(user.pullDomainEvents()).toHaveLength(1);
    expect(user.pullDomainEvents()).toHaveLength(0);
  });
});
