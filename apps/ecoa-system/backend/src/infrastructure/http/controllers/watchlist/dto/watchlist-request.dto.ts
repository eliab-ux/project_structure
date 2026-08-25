import { IsString, MaxLength, MinLength } from 'class-validator';

export class AddWatchlistRequestDto {
  // Up to 31 chars: 30 handle chars + an optional leading '@' the VO strips.
  @IsString()
  @MinLength(1)
  @MaxLength(31)
  handle!: string;
}
