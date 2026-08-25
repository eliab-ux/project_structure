import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateMaterialRequestDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsNotEmpty()
  type!: string;

  /** Base64-encoded file content */
  @IsString()
  @IsNotEmpty()
  fileBase64!: string;

  @IsString()
  @IsNotEmpty()
  fileName!: string;

  @IsString()
  @IsNotEmpty()
  fileMimeType!: string;

  /** Base64-encoded thumbnail (optional) */
  @IsString()
  @IsOptional()
  thumbnailBase64?: string;

  @IsString()
  @IsOptional()
  thumbnailName?: string;

  @IsString()
  @IsOptional()
  thumbnailMimeType?: string;
}
