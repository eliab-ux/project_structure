import { Psicologo } from '../../domain/entities/psicologo.entity';

/**
 * Boundary DTO. NUNCA expõe passwordHash nem recoveryCode (ausência intencional).
 */
export class PsicologoDto {
  id!: string;
  email!: string;
  nome!: string;
  telefone!: string;
  emailVerificado!: boolean;
  createdAt!: Date;

  static fromDomain(psicologo: Psicologo): PsicologoDto {
    const dto = new PsicologoDto();
    dto.id = psicologo.id.value;
    dto.email = psicologo.email.value;
    dto.nome = psicologo.nome;
    dto.telefone = psicologo.telefone;
    dto.emailVerificado = psicologo.emailVerificado;
    dto.createdAt = psicologo.createdAt;
    return dto;
  }
}
