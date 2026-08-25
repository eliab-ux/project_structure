import { Paciente } from '../../domain/entities/paciente.entity';

/**
 * DTO para a área do psicólogo (dono do paciente). Inclui o `hash` porque o psicólogo
 * precisa dele para montar o link de convite da sessão. NÃO é usado em respostas públicas.
 */
export class PacienteDto {
  id!: string;
  nome!: string;
  email!: string;
  telefone!: string;
  pais!: string | null;
  hash!: string;
  createdAt!: Date;

  static fromDomain(paciente: Paciente): PacienteDto {
    const dto = new PacienteDto();
    dto.id = paciente.id.value;
    dto.nome = paciente.nome;
    dto.email = paciente.email;
    dto.telefone = paciente.telefone;
    dto.pais = paciente.pais;
    dto.hash = paciente.hash;
    dto.createdAt = paciente.createdAt;
    return dto;
  }
}

/**
 * DTO público (verificação do link pelo próprio paciente): expõe o mínimo — só o nome.
 */
export class PacientePublicDto {
  nome!: string;

  static fromDomain(paciente: Paciente): PacientePublicDto {
    const dto = new PacientePublicDto();
    dto.nome = paciente.nome;
    return dto;
  }
}
