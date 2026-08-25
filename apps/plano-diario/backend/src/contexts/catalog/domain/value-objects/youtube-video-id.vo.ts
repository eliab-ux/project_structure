import { ValueObject } from '@gitspread/domain-primitives';
import { InvalidYoutubeVideoIdException } from '../exceptions/invalid-youtube-video-id.exception';

interface Props {
  value: string;
}

/**
 * ID de vídeo do YouTube (ex.: `aSi0uip5XHg`). Validar aqui é o que garante que a URL enviada
 * ao grupo nunca seja montada com lixo vindo de fora.
 */
export class YoutubeVideoId extends ValueObject<Props> {
  private constructor(props: Props) {
    super(props);
  }

  static create(value: string): YoutubeVideoId {
    const trimmed = (value ?? '').trim();
    if (!/^[A-Za-z0-9_-]{6,32}$/.test(trimmed)) {
      throw new InvalidYoutubeVideoIdException();
    }
    return new YoutubeVideoId({ value: trimmed });
  }

  get value(): string {
    return this.props.value;
  }

  /** URL curta canônica. Sem `?si=` — o parâmetro de tracking é volátil e não agrega nada. */
  get shortUrl(): string {
    return `https://youtu.be/${this.props.value}`;
  }
}
