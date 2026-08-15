import {
  IsIn,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IsIntentFieldMap } from './is-intent-field-map.validator';
import {
  INTENT_COMMAND_NAMES,
  IntentCommandName,
} from '../../../../../contexts/intent/domain/intent-command';

/**
 * A imagem anexada ao pedido — foto de documento.
 *
 * **Limite PRÓPRIO da rota, menor que o global.** O Fastify aceita 25 MB no corpo, e essa folga
 * existe para outros usos; aqui ela seria perigosa por dois motivos: cada chamada com imagem é paga
 * por token no provedor, e um upload de 25 MB numa rota autenticada é um jeito barato de gastar a
 * conta de alguém. 8 MB de base64 ≈ 6 MB de imagem, muito acima do que a compressão do cliente
 * produz (ela manda ~300 KB) — é teto de abuso, não de uso.
 */
export class IntentAttachmentDto {
  /** Lista fechada: o que a câmera e o seletor de arquivo do navegador produzem. */
  @IsIn(['image/jpeg', 'image/png', 'image/webp'], {
    message: 'Envie uma foto em JPEG, PNG ou WEBP.',
  })
  mimeType!: string;

  @IsString()
  @MinLength(100, { message: 'Imagem vazia.' })
  @MaxLength(8_000_000, { message: 'Imagem grande demais.' })
  dataBase64!: string;
}

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

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => IntentAttachmentDto)
  attachment?: IntentAttachmentDto;

  /**
   * QUANDO o aviso ao titular foi exibido — ISO 8601, obrigatório se houver imagem.
   *
   * **É requisito, não telemetria.** O aviso diz três coisas a quem fotografa: a imagem vai a um
   * provedor externo para leitura, não fica armazenada, e **obter o consentimento do titular do
   * documento é responsabilidade de quem tira a foto**. Sem esse campo, a rota recusa — de propósito:
   * o aviso é a única coisa que separa "o operador sabia" de "o sistema mandou a foto de alguém para
   * fora sem ninguém dizer nada".
   *
   * ⚠️ **Isto é registro em LOG, não trilha de auditoria.** A trilha (ADR-0004) não existe, e criar
   * tabela é mudança de modelo de dados. Um log estruturado com conta, usuário e horário responde
   * "foi exibido?" hoje; quando a trilha existir, este registro migra para lá — e a diferença entre
   * os dois (retenção, consulta, exportação) está escrita no ADR-0006.
   */
  @IsOptional()
  @IsISO8601({}, { message: 'Horário do aviso inválido.' })
  noticeAcknowledgedAt?: string;
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
