import {
  ResetPasswordUseCase,
  ResetPasswordCommand,
} from '../../../src/contexts/auth/application/use-cases/reset-password/reset-password.use-case';
import {
  RequestPasswordResetUseCase,
  RequestPasswordResetCommand,
} from '../../../src/contexts/auth/application/use-cases/request-password-reset/request-password-reset.use-case';
import {
  RefreshTokenUseCase,
  RefreshTokenCommand,
} from '../../../src/contexts/auth/application/use-cases/refresh-token/refresh-token.use-case';
import {
  GetMeUseCase,
  GetMeQuery,
} from '../../../src/contexts/auth/application/use-cases/get-me/get-me.use-case';
import {
  PacienteSessionAccessUseCase,
  PacienteSessionAccessCommand,
} from '../../../src/contexts/auth/application/use-cases/paciente-session-access/paciente-session-access.use-case';
import { RegisterPsicologoUseCase } from '../../../src/contexts/psicologo/application/use-cases/register-psicologo/register-psicologo.use-case';
import { RegisterPsicologoCommand } from '../../../src/contexts/psicologo/application/use-cases/register-psicologo/register-psicologo.command';
import {
  VerifyEmailUseCase,
  VerifyEmailCommand,
} from '../../../src/contexts/psicologo/application/use-cases/verify-email/verify-email.use-case';
import { Psicologo } from '../../../src/contexts/psicologo/domain/entities/psicologo.entity';
import { Email } from '../../../src/contexts/psicologo/domain/value-objects/email.vo';
import { Paciente } from '../../../src/contexts/paciente/domain/entities/paciente.entity';
import { InvalidCredentialsException } from '../../../src/contexts/auth/domain/exceptions/auth.exceptions';
import {
  PsicologoAlreadyExistsException,
  PsicologoNotFoundException,
} from '../../../src/contexts/psicologo/domain/exceptions/psicologo.exceptions';
import { PacienteNotFoundException } from '../../../src/contexts/paciente/domain/exceptions/paciente.exceptions';

const passthroughUow = { execute: <T>(work: () => Promise<T>) => work() };
const config = { get: jest.fn().mockReturnValue('http://localhost:3006') } as any;

function makePsicologo() {
  const p = Psicologo.register(Email.create('ana@x.com'), 'Ana Souza', '11999998888', 'HASH');
  p.verifyEmail();
  return p;
}

describe('ResetPasswordUseCase', () => {
  it('throws when the recovery code is invalid', async () => {
    const repo = { findByRecoveryCode: jest.fn().mockResolvedValue(null) } as any;
    const hasher = { hash: jest.fn(), compare: jest.fn() } as any;
    const uc = new ResetPasswordUseCase(repo, hasher, passthroughUow as any);
    await expect(
      uc.execute(new ResetPasswordCommand('000000', 'newsecret')),
    ).rejects.toBeInstanceOf(InvalidCredentialsException);
  });

  it('changes the password for a valid code', async () => {
    const p = makePsicologo();
    p.setRecoveryCode('123456');
    const repo = {
      findByRecoveryCode: jest.fn().mockResolvedValue(p),
      save: jest.fn().mockResolvedValue(p),
    } as any;
    const hasher = { hash: jest.fn().mockResolvedValue('newhash'), compare: jest.fn() } as any;
    const uc = new ResetPasswordUseCase(repo, hasher, passthroughUow as any);
    await uc.execute(new ResetPasswordCommand('123456', 'newsecret'));
    expect(hasher.hash).toHaveBeenCalledWith('newsecret');
    expect(repo.save).toHaveBeenCalled();
  });
});

describe('RequestPasswordResetUseCase', () => {
  it('does nothing (no leak) when the email is unknown', async () => {
    const repo = { findByEmail: jest.fn().mockResolvedValue(null), save: jest.fn() } as any;
    const notifier = { sendPasswordRecovery: jest.fn() } as any;
    const uc = new RequestPasswordResetUseCase(repo, notifier, passthroughUow as any);
    await uc.execute(new RequestPasswordResetCommand('ghost@x.com'));
    expect(repo.save).not.toHaveBeenCalled();
    expect(notifier.sendPasswordRecovery).not.toHaveBeenCalled();
  });

  it('sets a recovery code and notifies a known email', async () => {
    const p = makePsicologo();
    const repo = {
      findByEmail: jest.fn().mockResolvedValue(p),
      save: jest.fn().mockResolvedValue(p),
    } as any;
    const notifier = { sendPasswordRecovery: jest.fn().mockResolvedValue(undefined) } as any;
    const uc = new RequestPasswordResetUseCase(repo, notifier, passthroughUow as any);
    await uc.execute(new RequestPasswordResetCommand('ana@x.com'));
    expect(repo.save).toHaveBeenCalled();
    expect(p.recoveryCode).toBeTruthy();
  });
});

describe('RefreshTokenUseCase', () => {
  it('rejects an invalid refresh token', async () => {
    const tokens = {
      verifyRefreshToken: jest.fn().mockRejectedValue(new Error('bad')),
      signAccessToken: jest.fn(),
      signRefreshToken: jest.fn(),
      verifyAccessToken: jest.fn(),
    } as any;
    const uc = new RefreshTokenUseCase(tokens);
    await expect(uc.execute(new RefreshTokenCommand('bad'))).rejects.toThrow();
  });

  it('issues new tokens for a valid refresh token', async () => {
    const tokens = {
      verifyRefreshToken: jest.fn().mockResolvedValue({ sub: 'psi-1', role: 'psicologo' }),
      signAccessToken: jest.fn().mockResolvedValue('a'),
      signRefreshToken: jest.fn().mockResolvedValue('r'),
      verifyAccessToken: jest.fn(),
    } as any;
    const uc = new RefreshTokenUseCase(tokens);
    const result = await uc.execute(new RefreshTokenCommand('good'));
    expect(result).toEqual({ accessToken: 'a', refreshToken: 'r' });
  });
});

describe('GetMeUseCase', () => {
  it('throws when the psicologo is missing', async () => {
    const repo = { findById: jest.fn().mockResolvedValue(null) } as any;
    const uc = new GetMeUseCase(repo);
    await expect(uc.execute(new GetMeQuery('psi-x'))).rejects.toBeInstanceOf(
      PsicologoNotFoundException,
    );
  });

  it('returns the psicologo DTO', async () => {
    const p = makePsicologo();
    const repo = { findById: jest.fn().mockResolvedValue(p) } as any;
    const uc = new GetMeUseCase(repo);
    const dto = await uc.execute(new GetMeQuery(p.id.value));
    expect(dto.email).toBe('ana@x.com');
  });
});

describe('PacienteSessionAccessUseCase', () => {
  it('throws when the hash is unknown', async () => {
    const pacientes = { findByHash: jest.fn().mockResolvedValue(null) } as any;
    const tokens = { signAccessToken: jest.fn() } as any;
    const uc = new PacienteSessionAccessUseCase(pacientes, tokens);
    await expect(uc.execute(new PacienteSessionAccessCommand('x'))).rejects.toBeInstanceOf(
      PacienteNotFoundException,
    );
  });

  it('issues a paciente token for a valid hash', async () => {
    const paciente = Paciente.create({
      psicologoId: 'psi-1',
      email: 'p@x.com',
      nome: 'Paciente Um',
      telefone: '11988887777',
    });
    const pacientes = { findByHash: jest.fn().mockResolvedValue(paciente) } as any;
    const tokens = { signAccessToken: jest.fn().mockResolvedValue('token') } as any;
    const uc = new PacienteSessionAccessUseCase(pacientes, tokens);
    const result = await uc.execute(new PacienteSessionAccessCommand('h'));
    expect(result).toEqual({ accessToken: 'token', nome: 'Paciente Um' });
  });
});

describe('RegisterPsicologoUseCase', () => {
  it('rejects a duplicate email', async () => {
    const repo = {
      findByEmail: jest.fn().mockResolvedValue(makePsicologo()),
      save: jest.fn(),
    } as any;
    const hasher = { hash: jest.fn(), compare: jest.fn() } as any;
    const notifier = { sendEmailVerification: jest.fn() } as any;
    const uc = new RegisterPsicologoUseCase(repo, hasher, passthroughUow as any, notifier, config);
    await expect(
      uc.execute(new RegisterPsicologoCommand('ana@x.com', 'Ana Souza', '11999998888', 'secret')),
    ).rejects.toBeInstanceOf(PsicologoAlreadyExistsException);
  });

  it('registers a new psicologo and sends verification', async () => {
    const repo = {
      findByEmail: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockImplementation((p) => Promise.resolve(p)),
    } as any;
    const hasher = { hash: jest.fn().mockResolvedValue('h'), compare: jest.fn() } as any;
    const notifier = { sendEmailVerification: jest.fn().mockResolvedValue(undefined) } as any;
    const uc = new RegisterPsicologoUseCase(repo, hasher, passthroughUow as any, notifier, config);
    const dto = await uc.execute(
      new RegisterPsicologoCommand('nova@x.com', 'Nova Dra', '11999998888', 'secret'),
    );
    expect(dto.email).toBe('nova@x.com');
    expect(hasher.hash).toHaveBeenCalledWith('secret');
    expect(repo.save).toHaveBeenCalled();
  });
});

describe('VerifyEmailUseCase', () => {
  it('throws when the psicologo does not exist', async () => {
    const repo = { findById: jest.fn().mockResolvedValue(null), save: jest.fn() } as any;
    const uc = new VerifyEmailUseCase(repo, passthroughUow as any);
    await expect(uc.execute(new VerifyEmailCommand('psi-x'))).rejects.toBeInstanceOf(
      PsicologoNotFoundException,
    );
  });

  it('verifies the email and saves', async () => {
    const p = Psicologo.register(Email.create('ana@x.com'), 'Ana Souza', '11999998888', 'HASH');
    const repo = {
      findById: jest.fn().mockResolvedValue(p),
      save: jest.fn().mockResolvedValue(p),
    } as any;
    const uc = new VerifyEmailUseCase(repo, passthroughUow as any);
    await uc.execute(new VerifyEmailCommand(p.id.value));
    expect(p.emailVerificado).toBe(true);
    expect(repo.save).toHaveBeenCalled();
  });
});
