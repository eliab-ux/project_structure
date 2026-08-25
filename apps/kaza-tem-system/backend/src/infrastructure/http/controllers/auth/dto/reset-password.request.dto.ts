import { IsString, MinLength } from 'class-validator';

export class ResetPasswordRequestDto {
  @IsString()
  accessToken!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}
