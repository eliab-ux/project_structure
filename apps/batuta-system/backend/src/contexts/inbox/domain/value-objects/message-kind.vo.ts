/** §4, `messages.kind`. */
export enum MessageKind {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  /**
   * Mandatory in v1 (§10.2 item 3): "No Brasil boa parte do inbound vem por voz." The queue plays it
   * inline; transcription is explicitly out of scope, which is why audio is never auto-classified.
   */
  AUDIO = 'AUDIO',
  VIDEO = 'VIDEO',
  DOCUMENT = 'DOCUMENT',
  STICKER = 'STICKER',
  OTHER = 'OTHER',
}

export function isMedia(kind: MessageKind): boolean {
  return kind !== MessageKind.TEXT;
}
