import { PsicologoDto } from '../../../psicologo/application/dto/psicologo.dto';

export class LoginResultDto {
  accessToken!: string;
  refreshToken!: string;
  psicologo!: PsicologoDto;
}

export class TokensDto {
  accessToken!: string;
  refreshToken!: string;
}

export class PacienteAccessResultDto {
  accessToken!: string;
  nome!: string;
  sessionCode?: string;
}
