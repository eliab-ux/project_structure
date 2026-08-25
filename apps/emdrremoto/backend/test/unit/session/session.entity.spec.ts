import { Session } from '../../../src/contexts/session/domain/entities/session.entity';
import { SessionCreatedEvent } from '../../../src/contexts/session/domain/events/session-created.event';

describe('Session (domain)', () => {
  function make() {
    return Session.create({ psicologoId: 'psi-1', pacienteId: 'pac-1', dailyCoName: 'room-x' });
  }

  it('creates active with a session code and emits SessionCreatedEvent', () => {
    const s = make();
    expect(s.active).toBe(true);
    expect(s.sessionCode).toHaveLength(12);
    const events = s.pullDomainEvents();
    expect(events[0]).toBeInstanceOf(SessionCreatedEvent);
  });

  it('authorizes only the real participants (menor privilégio)', () => {
    const s = make();
    expect(s.isMember('psi-1', 'psicologo')).toBe(true);
    expect(s.isMember('pac-1', 'paciente')).toBe(true);
    expect(s.isMember('intruder', 'psicologo')).toBe(false);
    expect(s.isMember('pac-1', 'psicologo')).toBe(false);
  });

  it('records entry per role', () => {
    const s = make();
    expect(s.psicologoIn).toBeNull();
    s.registerEntry('psicologo');
    expect(s.psicologoIn).toBeInstanceOf(Date);
    expect(s.pacienteIn).toBeNull();
  });

  it('ends the session (inactive + session_out set)', () => {
    const s = make();
    s.end();
    expect(s.active).toBe(false);
    expect(s.sessionOut).toBeInstanceOf(Date);
  });
});
