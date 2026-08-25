import {
  AssertSessionMembershipUseCase,
  AssertSessionMembershipQuery,
} from '../../../src/contexts/session/application/use-cases/assert-session-membership/assert-session-membership.use-case';
import {
  RecordEntryUseCase,
  RecordEntryCommand,
} from '../../../src/contexts/session/application/use-cases/record-entry/record-entry.use-case';
import {
  EndSessionUseCase,
  EndSessionCommand,
} from '../../../src/contexts/session/application/use-cases/end-session/end-session.use-case';
import {
  CreateSessionUseCase,
  CreateSessionCommand,
} from '../../../src/contexts/session/application/use-cases/create-session/create-session.use-case';
import { Session } from '../../../src/contexts/session/domain/entities/session.entity';
import { Paciente } from '../../../src/contexts/paciente/domain/entities/paciente.entity';
import {
  SessionNotFoundException,
  SessionUnauthorizedException,
} from '../../../src/contexts/session/domain/exceptions/session.exceptions';
import { PacienteNotFoundException } from '../../../src/contexts/paciente/domain/exceptions/paciente.exceptions';

const passthroughUow = { execute: <T>(work: () => Promise<T>) => work() };

function makeSession() {
  return Session.create({ psicologoId: 'psi-1', pacienteId: 'pac-1', dailyCoName: 'room-1' });
}

describe('AssertSessionMembershipUseCase', () => {
  it('throws NotFound when the session code is unknown', async () => {
    const sessions = { findByCode: jest.fn().mockResolvedValue(null) } as any;
    const uc = new AssertSessionMembershipUseCase(sessions);
    await expect(
      uc.execute(new AssertSessionMembershipQuery('psi-1', 'psicologo', 'nope')),
    ).rejects.toBeInstanceOf(SessionNotFoundException);
  });

  it('throws Unauthorized when the user is not a member', async () => {
    const sessions = { findByCode: jest.fn().mockResolvedValue(makeSession()) } as any;
    const uc = new AssertSessionMembershipUseCase(sessions);
    await expect(
      uc.execute(new AssertSessionMembershipQuery('intruder', 'psicologo', 'c')),
    ).rejects.toBeInstanceOf(SessionUnauthorizedException);
  });

  it('returns the session for a legitimate member', async () => {
    const s = makeSession();
    const sessions = { findByCode: jest.fn().mockResolvedValue(s) } as any;
    const uc = new AssertSessionMembershipUseCase(sessions);
    await expect(
      uc.execute(new AssertSessionMembershipQuery('pac-1', 'paciente', 'c')),
    ).resolves.toBe(s);
  });
});

describe('RecordEntryUseCase', () => {
  it('rejects a non-member', async () => {
    const sessions = {
      findByCode: jest.fn().mockResolvedValue(makeSession()),
      save: jest.fn(),
    } as any;
    const uc = new RecordEntryUseCase(sessions, passthroughUow as any);
    await expect(
      uc.execute(new RecordEntryCommand('intruder', 'paciente', 'c')),
    ).rejects.toBeInstanceOf(SessionUnauthorizedException);
    expect(sessions.save).not.toHaveBeenCalled();
  });

  it('records entry and saves for a member', async () => {
    const s = makeSession();
    const sessions = {
      findByCode: jest.fn().mockResolvedValue(s),
      save: jest.fn().mockResolvedValue(s),
    } as any;
    const uc = new RecordEntryUseCase(sessions, passthroughUow as any);
    await uc.execute(new RecordEntryCommand('psi-1', 'psicologo', 'c'));
    expect(s.psicologoIn).toBeInstanceOf(Date);
    expect(sessions.save).toHaveBeenCalled();
  });
});

describe('EndSessionUseCase', () => {
  it('ends the session and deletes the video room', async () => {
    const s = makeSession();
    const sessions = {
      findByCode: jest.fn().mockResolvedValue(s),
      save: jest.fn().mockResolvedValue(s),
    } as any;
    const video = {
      deleteRoom: jest.fn().mockResolvedValue(undefined),
      createRoom: jest.fn(),
    } as any;
    const uc = new EndSessionUseCase(sessions, video, passthroughUow as any);
    await uc.execute(new EndSessionCommand('psi-1', 'psicologo', 'c'));
    expect(s.active).toBe(false);
    expect(video.deleteRoom).toHaveBeenCalledWith('room-1');
  });
});

describe('CreateSessionUseCase', () => {
  const config = { get: jest.fn().mockReturnValue('http://localhost:3006') } as any;

  it("rejects creating a session for someone else's patient", async () => {
    const pacientes = { findById: jest.fn().mockResolvedValue(null) } as any;
    const uc = new CreateSessionUseCase(
      {} as any,
      pacientes,
      {} as any,
      {} as any,
      passthroughUow as any,
      config,
    );
    await expect(
      uc.execute(new CreateSessionCommand('psi-1', '00000000-0000-4000-8000-000000000000')),
    ).rejects.toBeInstanceOf(PacienteNotFoundException);
  });

  it('creates the room + session and sends the invite for an owned patient', async () => {
    const paciente = Paciente.create({
      psicologoId: 'psi-1',
      email: 'p@x.com',
      nome: 'Paciente Um',
      telefone: '11988887777',
    });
    const pacientes = { findById: jest.fn().mockResolvedValue(paciente) } as any;
    const video = { createRoom: jest.fn().mockResolvedValue({ name: 'room-1', url: 'u' }) } as any;
    const notifier = { sendSessionInvite: jest.fn().mockResolvedValue(undefined) } as any;
    const sessions = {
      save: jest.fn().mockImplementation((s: Session) => Promise.resolve(s)),
    } as any;
    const uc = new CreateSessionUseCase(
      sessions,
      pacientes,
      video,
      notifier,
      passthroughUow as any,
      config,
    );

    const dto = await uc.execute(new CreateSessionCommand('psi-1', paciente.id.value));

    expect(video.createRoom).toHaveBeenCalled();
    expect(sessions.save).toHaveBeenCalled();
    expect(dto.sessionCode).toHaveLength(12);
  });
});
