import { IsString, IsUUID } from 'class-validator';

export class CreateSessionRequestDto {
  @IsString()
  @IsUUID('4', { message: 'pacienteId inválido.' })
  pacienteId!: string;
}
