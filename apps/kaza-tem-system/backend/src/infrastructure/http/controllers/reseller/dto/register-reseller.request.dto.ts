import { IsString, Length } from 'class-validator';

export class RegisterResellerRequestDto {
  @IsString()
  userId!: string;

  @IsString()
  @Length(11, 14)
  cpf!: string;

  @IsString()
  fullName!: string;
}
