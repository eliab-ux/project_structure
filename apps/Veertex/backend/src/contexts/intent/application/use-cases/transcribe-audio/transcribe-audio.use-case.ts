import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UseCase } from '@gitspread/shared-kernel';
import { AUDIO_TRANSCRIBER, AudioTranscriberPort } from '../../ports/output/audio-transcriber.port';
import { AudioTranscriptionDisabledException } from '../../../domain/intent-exceptions';

export class TranscribeAudioCommand {
  constructor(
    public readonly dataBase64: string,
    public readonly mimeType: string,
  ) {}
}

/**
 * Transcreve o áudio ditado. **Não interpreta, não executa, não grava nada.**
 *
 * O texto volta para o CAMPO da tela, como rascunho editável, e o operador decide se envia. É a
 * contenção do erro que mais importa nesta cadeia: com transcrição automática, um "não" perdido
 * inverte uma permissão — e só um humano lendo a frase antes de aprovar impede que isso chegue ao
 * banco. Por isso a transcrição nunca alimenta a tradução diretamente.
 *
 * ## A flag, e por que ela existe
 *
 * `AUDIO_TRANSCRIPTION_ENABLED` nasce **desligada**, e não é preferência de rollout: enquanto a
 * chave do Gemini for de free tier, o conteúdo enviado pode ser lido por revisor humano e usado para
 * treino (ver `DEPENDENCIAS_EXTERNAS.md` §5). Áudio de comando carrega nome de pessoa e de empresa —
 * ele não sai por esse canal. A flag liga junto com a chave própria com billing ativo.
 *
 * Desligada, a rota RECUSA e o frontend não exibe o microfone. Não é botão cinza: é ausência.
 */
@Injectable()
export class TranscribeAudioUseCase implements UseCase<TranscribeAudioCommand, string> {
  private readonly logger = new Logger(TranscribeAudioUseCase.name);

  constructor(
    @Inject(AUDIO_TRANSCRIBER) private readonly transcriber: AudioTranscriberPort,
    private readonly config: ConfigService,
  ) {}

  /** Lida pelo controller para dizer ao frontend se o microfone deve existir. */
  isEnabled(): boolean {
    return this.config.get<string>('AUDIO_TRANSCRIPTION_ENABLED') === 'true';
  }

  async execute(command: TranscribeAudioCommand): Promise<string> {
    if (!this.isEnabled()) {
      this.logger.warn('Transcrição de áudio pedida com a flag desligada');
      throw new AudioTranscriptionDisabledException();
    }
    this.transcriber.ensureAvailable();

    // O áudio NÃO vai para log — nem o tamanho, que já diria quanto a pessoa falou.
    return this.transcriber.transcribe({
      dataBase64: command.dataBase64,
      mimeType: command.mimeType,
    });
  }
}
