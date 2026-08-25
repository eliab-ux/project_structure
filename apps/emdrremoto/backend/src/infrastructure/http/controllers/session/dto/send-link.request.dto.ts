import { IsIn, IsString, IsUUID } from 'class-validator';

export class SendLinkRequestDto {
  @IsString()
  @IsUUID('4', { message: 'pacienteId inválido.' })
  pacienteId!: string;

  @IsIn(['whatsapp', 'email'], { message: 'channel deve ser whatsapp ou email.' })
  channel!: 'whatsapp' | 'email';
}
