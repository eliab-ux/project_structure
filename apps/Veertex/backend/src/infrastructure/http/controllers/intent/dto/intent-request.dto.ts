import { IsIn, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';
import { IsIntentFieldMap } from './is-intent-field-map.validator';
import {
  INTENT_COMMAND_NAMES,
  IntentCommandName,
} from '../../../../../contexts/intent/domain/intent-command';

export class ParseIntentRequestDto {
  /**
   * O texto do operador. **Só texto nesta fatia** — voz entra depois (decisão de 12/08/2026).
   *
   * `MaxLength` não é capricho: o texto vai para um provedor externo cobrado por token, e um campo sem
   * teto é uma fatura sem teto. 2000 caracteres é muito acima de qualquer frase de operação.
   */
  @IsString()
  @MinLength(2, { message: 'Escreva o que você precisa.' })
  @MaxLength(2000)
  text!: string;
}

export class BuildDraftRequestDto {
  @IsIn(INTENT_COMMAND_NAMES, { message: 'Ação desconhecida.' })
  command!: IntentCommandName;

  /**
   * O mapa de campos. Validado por `@IsIntentFieldMap`, e não por `@ValidateNested({ each: true })` —
   * ver o docblock do validador para o motivo (o `each` é para array e produz mensagem que não
   * descreve erro nenhum quando aplicado a objeto de chaves dinâmicas).
   *
   * Chave a mais DENTRO de um campo não é recusada aqui, e não precisa ser: o
   * `BuildIntentDraftUseCase` remonta cada campo a partir de `value`, `origin` e `review` apenas, então
   * nada além disso atravessa para o domínio.
   */
  @IsIntentFieldMap()
  fields!: Record<string, { value: unknown; origin?: string | null; review?: boolean }>;
}

export class ApproveIntentRequestDto extends BuildDraftRequestDto {
  /**
   * O rascunho a aprovar. Validado como UUID mesmo sem persistência: o formato faz parte do contrato
   * desde já (decisão de 12/08/2026), e aceitar qualquer string agora abriria espaço para o cliente
   * mandar algo que a tabela futura recusaria.
   *
   * ⚠️ Ele **não** é usado para recuperar estado — não há estado. Serve de correlação em log e de
   * contrato estável para quando a persistência entrar.
   */
  @IsUUID('4', { message: 'Rascunho inválido. Recarregue e tente novamente.' })
  draftId!: string;
}

/**
 * O áudio ditado, em base64.
 *
 * `MaxLength(9_000_000)` ≈ 6,5 MB de áudio depois do base64. Sessenta segundos de Opus mono a 16 kHz
 * dão algo como 100 KB, então o teto é uma barreira contra abuso — não um limite de uso. O corpo do
 * Fastify aceita 25 MB, e uma rota que chama provedor pago por chamada não deve herdar esse teto.
 *
 * O `mimeType` é uma lista fechada: o que o MediaRecorder produz. Aceitar qualquer string faria a
 * validação do formato acontecer só no provedor, do outro lado da rede e da cobrança.
 */
export class TranscribeAudioRequestDto {
  @IsString()
  @MinLength(100, { message: 'Áudio vazio ou curto demais.' })
  @MaxLength(9_000_000, { message: 'Áudio grande demais. Grave até 60 segundos.' })
  dataBase64!: string;

  @IsString()
  @Matches(/^audio\/(webm|ogg|mp4|mpeg)(;\s*codecs=[\w.]+)?$/, {
    message: 'Formato de áudio não suportado.',
  })
  mimeType!: string;
}
