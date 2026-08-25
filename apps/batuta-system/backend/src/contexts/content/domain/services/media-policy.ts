import { MediaKind } from '../value-objects/media-kind.vo';
import { InvalidMediaException } from '../exceptions/invalid-media.exception';

/**
 * What may be attached, and how big (§7 item 4: "Validar mime type e tamanho por tipo").
 *
 * The limits are WhatsApp's practical ones, not ours: sending a file the provider will reject wastes
 * a send against the channel quota and looks like a delivery failure to the throttle. The mime list is
 * an allowlist — an allowlist is the only kind of file-type check that holds.
 */
const MEDIA_RULES: Readonly<Record<MediaKind, { maxBytes: number; mimeTypes: readonly string[] }>> =
  {
    [MediaKind.IMAGE]: {
      maxBytes: 5 * 1024 * 1024,
      mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    },
    [MediaKind.VIDEO]: {
      maxBytes: 16 * 1024 * 1024,
      mimeTypes: ['video/mp4', 'video/3gpp'],
    },
    [MediaKind.DOCUMENT]: {
      maxBytes: 20 * 1024 * 1024,
      mimeTypes: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ],
    },
  };

/** Magic bytes for the formats worth checking. A renamed .exe must not pass as a .jpg. */
const MAGIC_BYTES: readonly { mime: string; bytes: readonly number[]; offset?: number }[] = [
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] },
  // RIFF....WEBP
  { mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46] },
  // MP4 / 3GPP: 'ftyp' at offset 4.
  { mime: 'video/mp4', bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 },
  { mime: 'video/3gpp', bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 },
];

export interface MediaValidationInput {
  kind: MediaKind;
  mimeType: string;
  sizeBytes: number;
  /** Present on upload; absent when re-validating a stored reference. */
  buffer?: Buffer;
}

export function mediaRulesFor(kind: MediaKind): { maxBytes: number; mimeTypes: readonly string[] } {
  return MEDIA_RULES[kind];
}

/** Kind implied by a mime type, so the caller does not have to say both and risk disagreeing. */
export function mediaKindForMime(mimeType: string): MediaKind | null {
  const normalized = (mimeType ?? '').toLowerCase();
  for (const kind of Object.values(MediaKind)) {
    if (MEDIA_RULES[kind].mimeTypes.includes(normalized)) {
      return kind;
    }
  }
  return null;
}

/**
 * Validates an attachment. Throws with a message the operator can act on — "arquivo inválido" tells
 * someone with a 30 MB video nothing.
 */
export function assertValidMedia(input: MediaValidationInput): void {
  const rules = MEDIA_RULES[input.kind];
  const mime = (input.mimeType ?? '').toLowerCase();

  if (!rules) {
    throw new InvalidMediaException(`Tipo de mídia desconhecido: ${input.kind}.`);
  }

  if (!rules.mimeTypes.includes(mime)) {
    throw new InvalidMediaException(
      `Formato ${mime || 'não informado'} não é aceito para ${input.kind}. ` +
        `Aceitos: ${rules.mimeTypes.join(', ')}.`,
    );
  }

  if (input.sizeBytes <= 0) {
    throw new InvalidMediaException('Arquivo vazio.');
  }

  if (input.sizeBytes > rules.maxBytes) {
    const limitMb = Math.round(rules.maxBytes / (1024 * 1024));
    const actualMb = (input.sizeBytes / (1024 * 1024)).toFixed(1);
    throw new InvalidMediaException(
      `Arquivo de ${actualMb} MB passa do limite de ${limitMb} MB para ${input.kind}.`,
    );
  }

  if (input.buffer && !matchesMagicBytes(input.buffer, mime)) {
    // The declared mime type comes from the client and is a claim, not evidence.
    throw new InvalidMediaException(
      `O conteúdo do arquivo não corresponde ao formato declarado (${mime}).`,
    );
  }
}

function matchesMagicBytes(buffer: Buffer, mime: string): boolean {
  const expectations = MAGIC_BYTES.filter((candidate) => candidate.mime === mime);
  if (expectations.length === 0) {
    // Office formats are zip containers with many valid signatures; size and extension checks plus
    // the allowlist are what we rely on there.
    return true;
  }

  return expectations.some(({ bytes, offset = 0 }) => {
    if (buffer.length < offset + bytes.length) {
      return false;
    }
    return bytes.every((byte, index) => buffer[offset + index] === byte);
  });
}
