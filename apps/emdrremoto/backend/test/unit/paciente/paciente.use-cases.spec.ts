import {
  CreatePacienteUseCase,
  CreatePacienteCommand,
} from '../../../src/contexts/paciente/application/use-cases/create-paciente/create-paciente.use-case';
import {
  DeletePacienteUseCase,
  DeletePacienteCommand,
} from '../../../src/contexts/paciente/application/use-cases/delete-paciente/delete-paciente.use-case';
import {
  ListPacientesUseCase,
  ListPacientesQuery,
} from '../../../src/contexts/paciente/application/use-cases/list-pacientes/list-pacientes.use-case';
import {
  GetPacienteByHashUseCase,
  GetPacienteByHashQuery,
} from '../../../src/contexts/paciente/application/use-cases/get-paciente-by-hash/get-paciente-by-hash.use-case';
import { Paciente } from '../../../src/contexts/paciente/domain/entities/paciente.entity';
import { PacienteNotFoundException } from '../../../src/contexts/paciente/domain/exceptions/paciente.exceptions';

const passthroughUow = { execute: <T>(work: () => Promise<T>) => work() };

function makePaciente(psicologoId = 'psi-1') {
  return Paciente.create({
    psicologoId,
    email: 'p@x.com',
    nome: 'Paciente Um',
    telefone: '11988887777',
  });
}

describe('CreatePacienteUseCase', () => {
  it('creates and returns a DTO with the invite hash', async () => {
    const repo = { save: jest.fn().mockImplementation((p) => Promise.resolve(p)) } as any;
    const uc = new CreatePacienteUseCase(repo, passthroughUow as any);
    const dto = await uc.execute(
      new CreatePacienteCommand('psi-1', 'p@x.com', 'Paciente Um', '11988887777'),
    );
    expect(dto.hash).toMatch(/^[0-9a-f]{32}$/);
    expect(repo.save).toHaveBeenCalled();
  });
});

describe('DeletePacienteUseCase', () => {
  it('rejects deleting a patient owned by another psychologist', async () => {
    const paciente = makePaciente('other-psi');
    const repo = { findById: jest.fn().mockResolvedValue(paciente), delete: jest.fn() } as any;
    const uc = new DeletePacienteUseCase(repo, passthroughUow as any);
    await expect(
      uc.execute(new DeletePacienteCommand(paciente.id.value, 'psi-1')),
    ).rejects.toBeInstanceOf(PacienteNotFoundException);
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('deletes an owned patient', async () => {
    const paciente = makePaciente('psi-1');
    const repo = {
      findById: jest.fn().mockResolvedValue(paciente),
      delete: jest.fn().mockResolvedValue(undefined),
    } as any;
    const uc = new DeletePacienteUseCase(repo, passthroughUow as any);
    await uc.execute(new DeletePacienteCommand(paciente.id.value, 'psi-1'));
    expect(repo.delete).toHaveBeenCalled();
  });
});

describe('ListPacientesUseCase', () => {
  it('maps the psychologist patients to DTOs', async () => {
    const repo = {
      findByPsicologo: jest.fn().mockResolvedValue([makePaciente(), makePaciente()]),
    } as any;
    const uc = new ListPacientesUseCase(repo);
    const list = await uc.execute(new ListPacientesQuery('psi-1'));
    expect(list).toHaveLength(2);
  });
});

describe('GetPacienteByHashUseCase', () => {
  it('throws when the hash is unknown', async () => {
    const repo = { findByHash: jest.fn().mockResolvedValue(null) } as any;
    const uc = new GetPacienteByHashUseCase(repo);
    await expect(uc.execute(new GetPacienteByHashQuery('x'))).rejects.toBeInstanceOf(
      PacienteNotFoundException,
    );
  });

  it('returns only the public name for a valid hash', async () => {
    const repo = { findByHash: jest.fn().mockResolvedValue(makePaciente()) } as any;
    const uc = new GetPacienteByHashUseCase(repo);
    const dto = await uc.execute(new GetPacienteByHashQuery('h'));
    expect(dto.nome).toBe('Paciente Um');
    expect((dto as unknown as Record<string, unknown>).email).toBeUndefined();
  });
});
