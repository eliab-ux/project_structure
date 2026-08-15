import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import {
  AudioTranscriberPort,
  AudioTranscriptionRequest,
} from '../../contexts/intent/application/ports/output/audio-transcriber.port';
import { IntentChannelUnavailableException } from '../../contexts/intent/domain/intent-exceptions';

const DEFAULT_MODEL = 'gemini-2.5-flash';
const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

/**
 * Transcrição de áudio pelo Gemini, por HTTP puro, sem SDK — mesma decisão dos outros adapters.
 *
 * ## A instrução é a parte que decide, não o modelo
 *
 * Um modelo de linguagem, deixado à vontade, **melhora** o que ouve: corrige concordância, arruma
 * pontuação e resume. Qualquer uma dessas três destrói o que precisamos. A pior delas é sutil — ao
 * "arrumar" uma frase falada às pressas, o modelo pode reescrever *"pode vender mas não pode dar
 * desconto"* como *"pode vender e dar desconto"*. Uma permissão invertida, com aparência de
 * transcrição fiel.
 *
 * Por isso a `systemInstruction` proíbe explicitamente: reescrever, corrigir, resumir e — em
 * destaque — **remover ou mover a negação**. E `temperature: 0`, porque criatividade aqui é defeito.
 *
 * ## O áudio nunca entra em log
 *
 * Nem o base64, nem o tamanho em `catch`, nem o texto transcrito. Áudio de comando carrega nome de
 * pessoa e de empresa; um log de transcrições é o registro de quem falou o quê dentro da conta do
 * cliente. Só o resultado estrutural (sucesso, duração da chamada) é registrado.
 */
@Injectable()
export class GeminiAudioTranscriber implements AudioTranscriberPort {
  private readonly logger = new Logger(GeminiAudioTranscriber.name);
  private readonly http: AxiosInstance;

  constructor(private readonly config: ConfigService) {
    // 30s: transcrição de até 60s de áudio é mais lenta que a tradução de texto, e o operador está
    // esperando na tela. Acima disso, é melhor devolver erro e deixá-lo retentar com o áudio que ele
    // ainda tem do que segurar uma conexão indefinidamente.
    this.http = axios.create({ timeout: 30_000 });
  }

  ensureAvailable(): void {
    if (!this.apiKey()) {
      this.logger.error('Transcrição indisponível: GEMINI_API_KEY ausente no ambiente.');
      throw new IntentChannelUnavailableException();
    }
  }

  async transcribe(request: AudioTranscriptionRequest): Promise<string> {
    this.ensureAvailable();

    const url = `${this.baseUrl()}/models/${this.model()}:generateContent`;
    const inicio = Date.now();

    try {
      const response = await this.http.post(
        url,
        {
          systemInstruction: { parts: [{ text: this.systemInstruction() }] },
          contents: [
            {
              role: 'user',
              parts: [
                { inline_data: { mime_type: request.mimeType, data: request.dataBase64 } },
                { text: 'Transcreva.' },
              ],
            },
          ],
          // Texto puro: `responseMimeType: 'application/json'` obrigaria o modelo a embrulhar a fala
          // num objeto, e embrulhar é uma forma de reescrever.
          generationConfig: { temperature: 0 },
        },
        { headers: { 'x-goog-api-key': this.apiKey() as string } },
      );

      const texto = (
        response.data as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
      )?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!texto || !texto.trim()) {
        // Silêncio, ruído ou recusa do modelo. Falha explícita: quem chamou mantém o áudio e retenta.
        this.logger.warn('Transcrição vazia');
        throw new IntentChannelUnavailableException();
      }

      this.logger.log('Áudio transcrito', {
        ms: Date.now() - inicio,
        // Só o TAMANHO do texto, nunca o conteúdo: serve para ver que algo veio, sem registrar o quê.
        caracteres: texto.trim().length,
      });

      return texto.trim();
    } catch (error) {
      if (error instanceof IntentChannelUnavailableException) {
        throw error;
      }
      // Sem o áudio e sem o corpo da resposta no log — o corpo pode ecoar a transcrição.
      this.logger.error('Falha ao transcrever áudio', {
        reason: (error as Error)?.name ?? 'unknown',
        ms: Date.now() - inicio,
      });
      throw new IntentChannelUnavailableException();
    }
  }

  private systemInstruction(): string {
    return [
      'Você é um transcritor. Devolva EXATAMENTE o que foi dito no áudio, em português do Brasil.',
      '',
      'Regras absolutas:',
      '1. Transcrição LITERAL. Não reescreva, não melhore, não resuma, não complete frase cortada.',
      '2. NÃO corrija gramática, concordância nem ordem das palavras. Se a pessoa falou errado,',
      '   transcreva errado.',
      '3. **NUNCA remova, mova ou suavize uma negação.** Se ouviu "não", escreva "não", no mesmo',
      '   lugar da frase. Trocar "pode vender mas não pode dar desconto" por "pode vender e dar',
      '   desconto" é o pior erro possível nesta tarefa: inverte uma permissão.',
      '4. Não acrescente pontuação que mude o sentido, nem comentários, nem aspas em volta.',
      '5. Números podem ser escritos como falados ("dez por cento") ou em algarismos ("10%") —',
      '   mantenha o que foi dito.',
      '6. Se o áudio estiver inaudível ou vazio, devolva uma linha em branco. Não invente conteúdo.',
      '',
      'Responda SOMENTE com a transcrição, sem nenhum texto seu em volta.',
    ].join('\n');
  }

  private baseUrl(): string {
    return this.config.get<string>('GEMINI_API_URL')?.replace(/\/+$/, '') || DEFAULT_BASE_URL;
  }

  private apiKey(): string | undefined {
    return this.config.get<string>('GEMINI_API_KEY') || undefined;
  }

  private model(): string {
    return this.config.get<string>('GEMINI_MODEL') || DEFAULT_MODEL;
  }
}
