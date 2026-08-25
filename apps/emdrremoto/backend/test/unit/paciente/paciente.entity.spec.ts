import { Paciente } from '../../../src/contexts/paciente/domain/entities/paciente.entity';
import { PacienteCreatedEvent } from '../../../src/contexts/paciente/domain/events/paciente-created.event';

describe('Paciente (domain)', () => {
  function make() {
    return Paciente.create({
      psicologoId: 'psi-1',
      email: 'Paciente@Example.com',
      nome: 'João Lima',
      telefone: '11988887777',
      pais: ' Brasil ',
    });
  }

  it('creates with a unique invite hash and normalized fields', () => {
    const p = make();
    expect(p.email).toBe('paciente@example.com');
    expect(p.pais).toBe('Brasil');
    expect(p.hash).toMatch(/^[0-9a-f]{32}$/);
    expect(p.pullDomainEvents()[0]).toBeInstanceOf(PacienteCreatedEvent);
  });

  it('regenerates the hash (revokes the previous invite)', () => {
    const p = make();
    const first = p.hash;
    p.regenerateHash();
    expect(p.hash).not.toBe(first);
  });

  it('rejects invalid email', () => {
    expect(() =>
      Paciente.create({
        psicologoId: 'psi-1',
        email: 'x',
        nome: 'João Lima',
        telefone: '11988887777',
      }),
    ).toThrow();
  });
});
