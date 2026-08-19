import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CompanyModule } from '../company/company.module';
import { ModuleModule } from '../module/module.module';
import { ContactModule } from '../contact/contact.module';
import { ProductModule } from '../product/product.module';
import { RoleModule } from '../role/role.module';
import { UserModule } from '../user/user.module';
import { DeterministicIntentParser } from '../../infrastructure/intent/deterministic-intent-parser';
import { GeminiIntentParser } from '../../infrastructure/intent/gemini-intent-parser';
import { INTENT_PARSER } from './application/ports/output/intent-parser.port';
import { AuthorizeIntentCommandUseCase } from './application/use-cases/authorize-intent-command/authorize-intent-command.use-case';
import { ParseIntentUseCase } from './application/use-cases/parse-intent/parse-intent.use-case';
import { BuildIntentDraftUseCase } from './application/use-cases/build-intent-draft/build-intent-draft.use-case';
import { ApproveIntentUseCase } from './application/use-cases/approve-intent/approve-intent.use-case';
import { TranscribeAudioUseCase } from './application/use-cases/transcribe-audio/transcribe-audio.use-case';
import { AUDIO_TRANSCRIBER } from './application/ports/output/audio-transcriber.port';
import { GeminiAudioTranscriber } from '../../infrastructure/intent/gemini-audio-transcriber';

/**
 * A escolha do tradutor é feita AQUI, por configuração explícita — e nunca por fallback.
 *
 * `INTENT_PARSER_DRIVER=deterministic` usa o tradutor por palavra-chave (testes, desenvolvimento sem
 * chave). Qualquer outro valor, ou a ausência dele, usa o Gemini.
 *
 * **O padrão é o Gemini de propósito.** Um padrão que caísse no determinístico faria um ambiente mal
 * configurado *parecer funcionar*: a Mesa aceitaria a frase, devolveria um comando reconhecido por
 * palavra-chave e o chamaria de tradução. O operador aprovaria uma ação que o texto dele não pedia, e
 * a procedência diria "ditado" para um valor que ninguém ditou. Com o Gemini como padrão, ambiente sem
 * chave **falha visivelmente** no `ensureAvailable()` — que é o comportamento correto para uma falha
 * de configuração.
 *
 * O determinístico é opt-in explícito, e é o que permite testar o fluxo inteiro sem chamada externa
 * paga e não determinística (condição registrada por Eliab em 12/08/2026).
 */
@Module({
  imports: [
    ConfigModule,
    // `RoleModule` e `UserModule` pelos Use Cases que a aprovação despacha; `ModuleModule` pelo
    // toggle. A aprovação chama os MESMOS Use Cases que os controllers HTTP chamam — é isso que
    // impede a intenção de ser um caminho com validação mais frouxa.
    RoleModule,
    // Pelo despacho de CreateContact/UpdateContact — a aprovação chama os MESMOS use cases que o
    // controller de contatos chama.
    ContactModule,
    ProductModule,
    UserModule,
    ModuleModule,
    CompanyModule,
  ],
  providers: [
    DeterministicIntentParser,
    GeminiIntentParser,
    {
      provide: INTENT_PARSER,
      inject: [ConfigService, DeterministicIntentParser, GeminiIntentParser],
      useFactory: (
        config: ConfigService,
        deterministic: DeterministicIntentParser,
        gemini: GeminiIntentParser,
      ) =>
        config.get<string>('INTENT_PARSER_DRIVER') === 'deterministic' ? deterministic : gemini,
    },
    AuthorizeIntentCommandUseCase,
    /*
     * A transcrição NÃO tem adapter determinístico, e a ausência é decisão: não existe "transcrever
     * por palavra-chave". Um adapter falso aqui devolveria texto fixo, e um teste que exercitasse
     * isso estaria verificando a si mesmo. O que a suíte verifica é o ADAPTER REAL contra um servidor
     * de mentira — o mesmo padrão do Evolution.
     */
    GeminiAudioTranscriber,
    { provide: AUDIO_TRANSCRIBER, useClass: GeminiAudioTranscriber },
    TranscribeAudioUseCase,
    ParseIntentUseCase,
    BuildIntentDraftUseCase,
    ApproveIntentUseCase,
  ],
  exports: [
    AuthorizeIntentCommandUseCase,
    TranscribeAudioUseCase,
    ParseIntentUseCase,
    BuildIntentDraftUseCase,
    ApproveIntentUseCase,
  ],
})
export class IntentModule {}
