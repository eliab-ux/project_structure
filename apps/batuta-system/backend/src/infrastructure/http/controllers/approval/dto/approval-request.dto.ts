import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { NotifyChannel } from '../../../../../contexts/approval/domain/value-objects/notify-channel.vo';

/** Long enough for a real objection, short enough not to be an essay in a log line. */
const MAX_COMMENT_LENGTH = 1000;

export class UpdateApprovalSettingsRequestDto {
  /**
   * 1 or 2, and nothing else (§8 item 1). `@IsIn` rather than `@Min`/`@Max` because the rule is a
   * closed set, not a range — "3 aprovadores" is not a bigger number, it is an unsupported flow.
   */
  @IsInt()
  @IsIn([1, 2], { message: 'requiredForInstitutional deve ser 1 ou 2.' })
  requiredForInstitutional!: number;

  @IsInt()
  @IsIn([1, 2], { message: 'requiredForElectoral deve ser 1 ou 2.' })
  requiredForElectoral!: number;

  @IsEnum(NotifyChannel, { message: 'notifyChannel deve ser EMAIL, WHATSAPP ou BOTH.' })
  notifyChannel!: NotifyChannel;
}

export class CreateApproverRequestDto {
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name!: string;

  /**
   * E-mail and phone are both optional HERE and the pair is validated in the domain: "at least one" is
   * a rule about the combination, which no per-field decorator can express. The entity throws
   * `ApproverWithoutContactException`, so an unreachable approver never reaches the database.
   */
  @IsOptional()
  @IsEmail({}, { message: 'E-mail inválido.' })
  @MaxLength(255)
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase().trim() : value))
  email?: string | null;

  /** E.164, same shape as a chip or a contact number. */
  @IsOptional()
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/, { message: 'Telefone deve estar em E.164, ex.: +5511999998888.' })
  phone?: string | null;
}

export class UpdateApproverRequestDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name?: string;

  /** `null` clears the field; omitting it leaves it untouched. The entity refuses clearing both. */
  @IsOptional()
  @IsEmail({}, { message: 'E-mail inválido.' })
  @MaxLength(255)
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase().trim() : value))
  email?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/, { message: 'Telefone deve estar em E.164, ex.: +5511999998888.' })
  phone?: string | null;

  /** Deactivation, not deletion: past decisions must remain attributable. */
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

/**
 * Submission carries no fields at all: what gets submitted is whatever the content currently is, and
 * the version is derived from it (`content_hash`). Accepting any content field here would let the
 * submission itself change what is being approved.
 */
export class SubmitForApprovalRequestDto {}

/**
 * The token as it arrives in the path.
 *
 * Validated in shape even though the lookup is by hash and a wrong token simply misses: 32 random bytes
 * in base64url are 43 characters of `[A-Za-z0-9_-]`, so anything else is not a link this system issued.
 * Rejecting it at the edge keeps junk out of the hash function, the index lookup and the rate-limit map.
 */
export class ApprovalTokenParamDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{32,64}$/, { message: 'Link de aprovação inválido.' })
  token!: string;
}

/**
 * Params da rota de mídia. Precisa declarar OS DOIS.
 *
 * `@Param()` sem chave valida o objeto de params INTEIRO, e o ValidationPipe global roda com
 * `forbidNonWhitelisted`. Reusar o DTO acima aqui fazia o `mediaId` ser recusado com "property
 * mediaId should not exist" — e o sintoma era a imagem da aprovação não carregar, sem nada na tela
 * explicando por quê.
 */
export class ApprovalMediaParamDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{32,64}$/, { message: 'Link de aprovação inválido.' })
  token!: string;

  @IsUUID('4', { message: 'Mídia inválida.' })
  mediaId!: string;
}

/** Body of the public decision route. The token is in the path, never in the body. */
export class DecideApprovalRequestDto {
  @IsIn(['APPROVE', 'REJECT'], { message: 'decision deve ser APPROVE ou REJECT.' })
  decision!: 'APPROVE' | 'REJECT';

  /**
   * Optional on approval, and deliberately optional on rejection too: the domain does not require a
   * comment, and refusing a rejection for lack of one would push people to approve rather than argue.
   */
  @IsOptional()
  @IsString()
  @MaxLength(MAX_COMMENT_LENGTH)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  comment?: string | null;
}
