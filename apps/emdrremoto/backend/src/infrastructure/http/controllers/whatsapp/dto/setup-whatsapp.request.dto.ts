import { IsIn } from 'class-validator';

export class SetupWhatsappRequestDto {
  @IsIn(['shared', 'own'], { message: 'mode deve ser shared ou own.' })
  mode!: 'shared' | 'own';
}
