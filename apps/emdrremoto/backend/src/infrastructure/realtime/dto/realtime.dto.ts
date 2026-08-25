import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class JoinSessionDto {
  @IsString()
  @MaxLength(64)
  sessionCode!: string;
}

export const MOVEMENT_TYPES = [
  'horizontal',
  'vertical',
  'diagonal1',
  'diagonal2',
  'sacadico',
] as const;

/**
 * Estado do estímulo bilateral (a "bola"), emitido pelo psicólogo a cada mudança de controle.
 * Payload TOTALMENTE TIPADO — proibido `any`/`[key: string]: any`. Todos os campos são
 * opcionais (atualização parcial), mas validados quando presentes.
 */
export class BallActionDto {
  @IsOptional()
  @IsBoolean()
  running?: boolean;

  @IsOptional()
  @IsBoolean()
  visible?: boolean;

  @IsOptional()
  @IsIn(MOVEMENT_TYPES)
  movement?: (typeof MOVEMENT_TYPES)[number];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  speed?: number;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'Cor deve ser hex #rrggbb.' })
  color?: string;

  @IsOptional()
  @IsInt()
  @Min(8)
  @Max(80)
  size?: number;

  // Reinicia a bola ao centro / zera o contador de movimentos.
  @IsOptional()
  @IsBoolean()
  reset?: boolean;

  // Nº máximo de movimentos (0 = infinito).
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000000000)
  maxMovements?: number;
}

export const AUDIO_CATEGORIES = ['tone', 'music'] as const;
export const MUTE_TARGETS = ['psicologo', 'paciente', 'ambos', 'none'] as const;

export class AudioActionDto {
  @IsOptional()
  @IsBoolean()
  playing?: boolean;

  @IsOptional()
  @IsIn(AUDIO_CATEGORIES)
  category?: (typeof AUDIO_CATEGORIES)[number];

  // Caminho relativo do arquivo servido em /sounds/... (mesma origem).
  @IsOptional()
  @IsString()
  @MaxLength(200)
  track?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  volume?: number;

  @IsOptional()
  @IsIn(MUTE_TARGETS)
  muteTarget?: (typeof MUTE_TARGETS)[number];
}

export class ChatMessageDto {
  @IsString()
  @MaxLength(2000)
  text!: string;
}

/** Sinalização WebRTC (offer/answer) — relay P2P via room, sem provedor externo. */
export class RtcDescriptionDto {
  @IsIn(['offer', 'answer'])
  type!: 'offer' | 'answer';

  @IsString()
  @MaxLength(40000)
  sdp!: string;
}

/** Candidato ICE do WebRTC. */
export class RtcIceDto {
  @IsString()
  @MaxLength(2000)
  candidate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  sdpMid?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  sdpMLineIndex?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  usernameFragment?: string | null;
}
