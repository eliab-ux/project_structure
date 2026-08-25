import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpsertScheduleRequestDto {
  /** Validado de novo no use case contra o cache de grupos do usuário. */
  @IsString()
  @Matches(/^[0-9]{5,30}(-[0-9]{1,20})?@g\.us$/, {
    message: 'groupJid deve ser um JID de grupo do WhatsApp (…@g.us)',
  })
  groupJid!: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'sendTime deve estar no formato HH:mm' })
  sendTime!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'planStartDate deve estar no formato AAAA-MM-DD' })
  planStartDate!: string;

  @IsOptional()
  @IsInt()
  @Min(-30)
  @Max(30)
  dayOffset?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  messageTemplate?: string;
}

export class ToggleScheduleRequestDto {
  @IsBoolean()
  isActive!: boolean;
}
