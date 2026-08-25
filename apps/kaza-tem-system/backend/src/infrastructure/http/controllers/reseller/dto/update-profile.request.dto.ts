import { IsOptional, IsString, Length } from 'class-validator';

export class UpdateResellerProfileRequestDto {
  @IsOptional()
  @IsString()
  @Length(2, 255)
  fullName?: string;

  @IsOptional()
  @IsString()
  @Length(10, 20)
  phone?: string;
}
