import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  ConversationPriority,
  ConversationStatus,
} from '../../../../../contexts/inbox/domain/value-objects/conversation-status.vo';
import { IntentClass } from '../../../../../contexts/inbox/domain/value-objects/intent-class.vo';

/** WhatsApp caps a text message around 4096 characters. */
const MAX_REPLY_LENGTH = 4000;

const TAG_PATTERN = /^[a-z0-9à-ÿ][a-z0-9à-ÿ _-]{0,39}$/i;

export class ListQueueQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsEnum(ConversationStatus)
  status?: ConversationStatus;

  @IsOptional()
  @IsEnum(ConversationPriority)
  priority?: ConversationPriority;

  @IsOptional()
  @IsEnum(IntentClass)
  intentClass?: IntentClass;

  @IsOptional()
  @IsUUID()
  channelId?: string;

  /** "Next item nobody is holding" — the queue's normal mode of use (§10.1). */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  unlockedOnly?: boolean;
}

export class SendReplyRequestDto {
  /**
   * The final text as the operator left it.
   *
   * MinLength 1 and not 0: an empty reply would be a message the contact receives as a blank bubble, and
   * it would consume a unit of the chip's daily quota to say nothing.
   */
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_REPLY_LENGTH)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  body!: string;

  /** Only for usage counting — the text above is what gets sent, edits included. */
  @IsOptional()
  @IsUUID()
  quickReplyId?: string;

  /** "Answer and close", saved as one action instead of two. */
  @IsOptional()
  @IsBoolean()
  resolve?: boolean;
}

export class ConversationActionRequestDto {
  @IsIn(['RESOLVE', 'ARCHIVE', 'RELEASE', 'REASSIGN'], {
    message: 'action deve ser RESOLVE, ARCHIVE, RELEASE ou REASSIGN.',
  })
  action!: 'RESOLVE' | 'ARCHIVE' | 'RELEASE' | 'REASSIGN';

  /** Required by REASSIGN; the use case refuses the action without it. */
  @IsOptional()
  @IsUUID()
  targetOperatorId?: string;
}

export class SaveQuickReplyRequestDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  body!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @Matches(TAG_PATTERN, { each: true, message: 'Tag inválida.' })
  tags?: string[];
}

export class ListQuickRepliesQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  search?: string;
}
