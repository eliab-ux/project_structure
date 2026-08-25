import { DomainException } from '@gitspread/domain-primitives';

/**
 * Não achou o vídeo do dia → NÃO envia nada. Nunca um vídeo aproximado, nunca o do dia
 * anterior, nunca fallback: enviar a leitura errada é uma falha silenciosa e pública.
 */
export class VideoNotFoundForDayException extends DomainException {
  constructor(public readonly dayNumber: number) {
    super(`Vídeo do dia ${dayNumber} não encontrado no catálogo`);
  }
}
