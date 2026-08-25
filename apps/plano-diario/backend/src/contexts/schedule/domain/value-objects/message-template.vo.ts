import { ValueObject } from '@gitspread/domain-primitives';
import { InvalidMessageTemplateException } from '../exceptions/invalid-message-template.exception';

interface Props {
  value: string;
}

/**
 * Template da mensagem enviada. Dois placeholders: `{{date}}` e `{{url}}`.
 *
 * `{{url}}` é **obrigatório** — sem ele a mensagem diária não teria o link do vídeo, que é a
 * única razão de existir do sistema. Um template sem `{{url}}` é erro de configuração, não
 * preferência de formatação.
 */
export class MessageTemplate extends ValueObject<Props> {
  static readonly DEFAULT = '{{date}}\n{{url}}';
  private static readonly MAX_LENGTH = 1000;

  private constructor(props: Props) {
    super(props);
  }

  static create(value?: string | null): MessageTemplate {
    const template = (value ?? MessageTemplate.DEFAULT).replace(/\r\n/g, '\n');
    if (template.trim().length === 0 || template.length > MessageTemplate.MAX_LENGTH) {
      throw new InvalidMessageTemplateException('Template vazio ou muito longo');
    }
    if (!template.includes('{{url}}')) {
      throw new InvalidMessageTemplateException('O template precisa conter {{url}}');
    }
    return new MessageTemplate({ value: template });
  }

  /** Substituição literal — nunca interpreta o conteúdo, só troca os dois placeholders. */
  render(params: { date: string; url: string }): string {
    return this.props.value.split('{{date}}').join(params.date).split('{{url}}').join(params.url);
  }

  get value(): string {
    return this.props.value;
  }
}
