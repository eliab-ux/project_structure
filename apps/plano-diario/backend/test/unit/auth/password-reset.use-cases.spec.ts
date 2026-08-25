import { PasswordResetCodeRepositoryPort } from '../../../src/contexts/auth/application/ports/output/password-reset-code-repository.port';
import { SupportMessengerPort } from '../../../src/contexts/auth/application/ports/output/support-messenger.port';
import { RequestPasswordResetUseCase } from '../../../src/contexts/auth/application/use-cases/request-password-reset/request-password-reset.use-case';
import { ResetPasswordUseCase } from '../../../src/contexts/auth/application/use-cases/reset-password/reset-password.use-case';
import {
  PasswordResetCode,
  RESET_CODE_MAX_ATTEMPTS,
} from '../../../src/contexts/auth/domain/entities/password-reset-code.entity';
import { InvalidResetCodeException } from '../../../src/contexts/auth/domain/exceptions/invalid-reset-code.exception';
import { SupportChannelUnavailableException } from '../../../src/contexts/auth/domain/exceptions/support-channel-unavailable.exception';
import { UserRepositoryPort } from '../../../src/contexts/user/application/ports/output/user-repository.port';
import { User } from '../../../src/contexts/user/domain/entities/user.entity';
import { Email } from '../../../src/contexts/user/domain/value-objects/email.vo';
import { PhoneNumber } from '../../../src/contexts/user/domain/value-objects/phone-number.vo';
import { PasswordHasherPort } from '../../../src/infrastructure/security/ports/password-hasher.port';

const EMAIL = 'eliab@exemplo.com';

function usuario(options: { comTelefone?: boolean; ativo?: boolean } = {}): User {
  const user = User.register(
    Email.create(EMAIL),
    'Eliab Caetano',
    'hash-antigo',
    PhoneNumber.create('(11) 91234-5678'),
  );
  if (options.comTelefone === false) {
    // Conta criada antes do campo existir: volta do banco sem número.
    return User.reconstitute(
      user.id,
      user.email,
      user.name,
      user.passwordHash,
      null,
      user.role,
      true,
      user.createdAt,
      user.updatedAt,
    );
  }
  if (options.ativo === false) {
    user.deactivate();
  }
  return user;
}

describe('Recuperação de senha', () => {
  let users: jest.Mocked<UserRepositoryPort>;
  let codes: jest.Mocked<PasswordResetCodeRepositoryPort>;
  let hasher: jest.Mocked<PasswordHasherPort>;
  let messenger: jest.Mocked<SupportMessengerPort>;

  beforeEach(() => {
    users = {
      save: jest.fn((user) => Promise.resolve(user)),
      findById: jest.fn(),
      findByEmail: jest.fn().mockResolvedValue(usuario()),
      exists: jest.fn(),
    };
    codes = {
      save: jest.fn((code) => Promise.resolve(code)),
      findLatestUnused: jest.fn().mockResolvedValue(null),
      countSentSince: jest.fn().mockResolvedValue(0),
      invalidateAllForUser: jest.fn(),
    };
    hasher = {
      hash: jest.fn().mockResolvedValue('hash-do-codigo'),
      compare: jest.fn().mockResolvedValue(true),
    };
    messenger = { ensureAvailable: jest.fn(), sendPasswordResetCode: jest.fn() };
  });

  describe('RequestPasswordResetUseCase', () => {
    let useCase: RequestPasswordResetUseCase;

    beforeEach(() => {
      useCase = new RequestPasswordResetUseCase(users, codes, hasher, messenger);
    });

    it('envia um código de 6 dígitos para o WhatsApp do usuário', async () => {
      await useCase.execute({ email: EMAIL });

      const enviado = messenger.sendPasswordResetCode.mock.calls[0][0];
      expect(enviado.phone).toBe('5511912345678');
      expect(enviado.code).toMatch(/^\d{6}$/);
      expect(enviado.name).toBe('Eliab');
    });

    it('guarda o HASH do código, nunca o código em claro', async () => {
      await useCase.execute({ email: EMAIL });

      const codigoEnviado = messenger.sendPasswordResetCode.mock.calls[0][0].code;
      const salvo = codes.save.mock.calls[0][0];
      expect(hasher.hash).toHaveBeenCalledWith(codigoEnviado);
      expect(salvo.codeHash).toBe('hash-do-codigo');
      // O valor em claro não pode estar em nenhum campo persistido.
      expect(JSON.stringify(salvo)).not.toContain(codigoEnviado);
    });

    it('invalida códigos anteriores antes de emitir um novo', async () => {
      await useCase.execute({ email: EMAIL });

      // Dois códigos vivos dobrariam a chance de adivinhação.
      expect(codes.invalidateAllForUser).toHaveBeenCalled();
    });

    it.each([
      ['e-mail desconhecido', () => users.findByEmail.mockResolvedValue(null)],
      ['conta desativada', () => users.findByEmail.mockResolvedValue(usuario({ ativo: false }))],
      [
        'conta sem WhatsApp',
        () => users.findByEmail.mockResolvedValue(usuario({ comTelefone: false })),
      ],
      ['limite por hora atingido', () => codes.countSentSince.mockResolvedValue(3)],
    ])('NÃO revela nada quando %s: sem erro e sem envio', async (_caso, arrange) => {
      arrange();

      // Não lançar é o ponto: um 4xx aqui viraria verificador de contas cadastradas.
      await expect(useCase.execute({ email: EMAIL })).resolves.toBeUndefined();
      expect(messenger.sendPasswordResetCode).not.toHaveBeenCalled();
      expect(codes.save).not.toHaveBeenCalled();
    });

    it('canal indisponível falha ANTES de consultar o usuário (senão vazaria quais contas existem)', async () => {
      messenger.ensureAvailable.mockImplementation(() => {
        throw new SupportChannelUnavailableException();
      });

      await expect(useCase.execute({ email: EMAIL })).rejects.toThrow(
        SupportChannelUnavailableException,
      );
      // Se o banco fosse consultado, e-mail real e e-mail inexistente teriam respostas diferentes.
      expect(users.findByEmail).not.toHaveBeenCalled();
      expect(codes.save).not.toHaveBeenCalled();
    });

    it('marca o código como enviado só DEPOIS do envio dar certo', async () => {
      // O `sentAt` é lido no momento da chamada: o use case grava a MESMA instância duas vezes,
      // então olhar `mock.calls` depois mostraria o estado final nas duas.
      const snapshots: (Date | null)[] = [];
      codes.save.mockImplementation((code) => {
        snapshots.push(code.sentAt);
        return Promise.resolve(code);
      });

      await useCase.execute({ email: EMAIL });

      // Primeira gravação cria (ainda não saiu); a segunda registra que saiu.
      expect(snapshots).toHaveLength(2);
      expect(snapshots[0]).toBeNull();
      expect(snapshots[1]).not.toBeNull();
    });

    it('envio que FALHA não consome a cota da próxima tentativa', async () => {
      messenger.sendPasswordResetCode.mockRejectedValue(new Error('Evolution fora do ar'));

      await expect(useCase.execute({ email: EMAIL })).rejects.toThrow();

      // Foi o defeito real: a versão anterior contava tentativas, então três falhas de
      // infraestrutura travavam a recuperação por uma hora sem uma única mensagem ter saído.
      expect(codes.save).toHaveBeenCalledTimes(1);
      expect(codes.save.mock.calls[0][0].sentAt).toBeNull();
    });

    it('o limite conta ENVIOS, não códigos criados', async () => {
      await useCase.execute({ email: EMAIL });

      // Se a contagem fosse por `createdAt`, códigos que nunca saíram entrariam na conta.
      expect(codes.countSentSince).toHaveBeenCalled();
    });

    it('códigos diferentes em solicitações diferentes', async () => {
      await useCase.execute({ email: EMAIL });
      await useCase.execute({ email: EMAIL });

      const [primeiro, segundo] = messenger.sendPasswordResetCode.mock.calls.map((c) => c[0].code);
      expect(primeiro).not.toBe(segundo);
    });
  });

  describe('ResetPasswordUseCase', () => {
    let useCase: ResetPasswordUseCase;
    let user: User;
    let code: PasswordResetCode;

    beforeEach(() => {
      user = usuario();
      users.findByEmail.mockResolvedValue(user);
      code = PasswordResetCode.issue({ userId: user.id.value, codeHash: 'hash-do-codigo' });
      codes.findLatestUnused.mockResolvedValue(code);
      hasher.hash.mockResolvedValue('hash-da-senha-nova');
      useCase = new ResetPasswordUseCase(users, codes, hasher);
    });

    it('troca a senha e queima o código', async () => {
      await useCase.execute({ email: EMAIL, code: '123456', newPassword: 'SenhaNova123' });

      expect(user.passwordHash).toBe('hash-da-senha-nova');
      expect(code.usedAt).not.toBeNull();
      expect(users.save).toHaveBeenCalled();
    });

    it('código errado conta a tentativa e recusa', async () => {
      hasher.compare.mockResolvedValue(false);

      await expect(
        useCase.execute({ email: EMAIL, code: '000000', newPassword: 'SenhaNova123' }),
      ).rejects.toThrow(InvalidResetCodeException);

      // Contar a tentativa é o que transforma 1.000.000 de combinações em 5 chances.
      expect(code.attempts).toBe(1);
      expect(codes.save).toHaveBeenCalled();
      expect(users.save).not.toHaveBeenCalled();
    });

    it('código sem tentativas restantes é recusado mesmo estando correto', async () => {
      for (let i = 0; i < RESET_CODE_MAX_ATTEMPTS; i += 1) {
        code.registerFailedAttempt();
      }

      await expect(
        useCase.execute({ email: EMAIL, code: '123456', newPassword: 'SenhaNova123' }),
      ).rejects.toThrow(InvalidResetCodeException);
      expect(users.save).not.toHaveBeenCalled();
    });

    it('código expirado é recusado', async () => {
      const expirado = PasswordResetCode.issue({
        userId: user.id.value,
        codeHash: 'hash-do-codigo',
        // Emitido há 16 minutos; o código vale 15.
        now: new Date(Date.now() - 16 * 60_000),
      });
      codes.findLatestUnused.mockResolvedValue(expirado);

      await expect(
        useCase.execute({ email: EMAIL, code: '123456', newPassword: 'SenhaNova123' }),
      ).rejects.toThrow(InvalidResetCodeException);
    });

    it('código já usado não serve de novo', async () => {
      code.markUsed();

      await expect(
        useCase.execute({ email: EMAIL, code: '123456', newPassword: 'SenhaNova123' }),
      ).rejects.toThrow(InvalidResetCodeException);
    });

    it('sem código emitido, recusa com a MESMA mensagem de código errado', async () => {
      codes.findLatestUnused.mockResolvedValue(null);

      // Mensagem idêntica de propósito: distinguir contaria se um código já foi pedido.
      await expect(
        useCase.execute({ email: EMAIL, code: '123456', newPassword: 'SenhaNova123' }),
      ).rejects.toThrow('Código inválido ou expirado. Solicite um novo código.');
    });

    it('e-mail inexistente recusa sem revelar', async () => {
      users.findByEmail.mockResolvedValue(null);

      await expect(
        useCase.execute({ email: EMAIL, code: '123456', newPassword: 'SenhaNova123' }),
      ).rejects.toThrow(InvalidResetCodeException);
    });
  });
});
