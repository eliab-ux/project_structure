import { Body, Controller, Get, HttpCode, Logger, Post, UseGuards } from '@nestjs/common';
import { AuthTokenPayload } from '../../../../contexts/auth/application/ports/output/token-service.port';
import {
  ApproveIntentCommand,
  ApproveIntentResult,
  ApproveIntentUseCase,
} from '../../../../contexts/intent/application/use-cases/approve-intent/approve-intent.use-case';
import {
  BuildIntentDraftCommand,
  BuildIntentDraftUseCase,
  IntentDraft,
} from '../../../../contexts/intent/application/use-cases/build-intent-draft/build-intent-draft.use-case';
import {
  ParseIntentCommand,
  ParseIntentUseCase,
} from '../../../../contexts/intent/application/use-cases/parse-intent/parse-intent.use-case';
import { IntentApiResult, IntentField } from '../../../../contexts/intent/domain/intent-command';
import { CurrentUser } from '../../../security/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../security/guards/jwt-auth.guard';
import {
  ApproveIntentRequestDto,
  BuildDraftRequestDto,
  ParseIntentRequestDto,
  TranscribeAudioRequestDto,
} from './dto/intent-request.dto';
import {
  TranscribeAudioCommand,
  TranscribeAudioUseCase,
} from '../../../../contexts/intent/application/use-cases/transcribe-audio/transcribe-audio.use-case';

/**
 * Os três passos da navegação por intenção: traduzir, montar, aprovar.
 *
 * `JwtAuthGuard` no CONTROLLER, e nenhuma rota pública aqui — as três precisam do ator, porque as
 * três dependem de `plano ∩ conta ∩ papel`. Uma rota de tradução aberta seria um proxy de LLM grátis
 * apontando para a conta de alguém.
 *
 * **Não há `@RequirePermission` nos métodos, e a ausência é deliberada.** A permissão exigida depende
 * do COMANDO, não da rota: `SetRolePermissions` pede `roles.update` e `InviteUser` pede
 * `users.create`. Uma permissão fixa na rota seria errada nas duas direções — larga demais para o
 * comando mais restrito, estreita demais para o mais aberto. Quem decide é o
 * `AuthorizeIntentCommandUseCase`, que usa a MESMA função `grants()` do `PermissionGuard` e a mesma
 * permissão que o controller equivalente declara.
 *
 * Isso é o §8 da especificação: *"A IA não é caminho paralelo de autorização."* A rota é única; a
 * autorização é por comando.
 */
@Controller('intent')
@UseGuards(JwtAuthGuard)
export class IntentController {
  private readonly logger = new Logger(IntentController.name);

  constructor(
    private readonly parseIntentUseCase: ParseIntentUseCase,
    private readonly buildDraftUseCase: BuildIntentDraftUseCase,
    private readonly approveIntentUseCase: ApproveIntentUseCase,
    private readonly transcribeAudioUseCase: TranscribeAudioUseCase,
  ) {}

  /**
   * O que esta instalação sabe fazer — hoje, só se o ditado existe.
   *
   * A tela usa isto para decidir se o microfone **aparece**. Não é botão desabilitado: é ausência.
   * Sem esta rota, o frontend teria de adivinhar pelo ambiente (`NEXT_PUBLIC_...`), e uma segunda
   * fonte de verdade sobre "o ditado está ligado?" divergiria da primeira no dia em que a flag
   * mudasse só de um lado.
   */
  @Get('capabilities')
  capabilities(): { audioTranscription: boolean } {
    return { audioTranscription: this.transcribeAudioUseCase.isEnabled() };
  }

  /**
   * Transcreve o áudio ditado. **Não interpreta e não executa** — devolve texto.
   *
   * O texto volta para o CAMPO da tela como rascunho editável; a tradução para comando continua
   * sendo o `POST /intent`, com o operador no meio. Encadear as duas aqui pareceria mais rápido e
   * tiraria a única leitura humana que impede uma permissão invertida por erro de transcrição de
   * chegar ao banco.
   *
   * Sem `@RequirePermission`: transcrever não altera nada e não revela dado da conta. O
   * `JwtAuthGuard` do controller basta — e é necessário, senão a rota seria um transcritor grátis
   * apontando para a chave de alguém.
   */
  @Post('transcribe')
  @HttpCode(200)
  async transcribe(@Body() dto: TranscribeAudioRequestDto): Promise<{ text: string }> {
    const text = await this.transcribeAudioUseCase.execute(
      new TranscribeAudioCommand(dto.dataBase64, dto.mimeType),
    );
    return { text };
  }

  /**
   * Traduz texto em plano de comando. **Não grava nada, não decide nada.**
   *
   * 200 e não 201: nada foi criado. Um 201 aqui contaria ao cliente que existe recurso novo, e o
   * ponto inteiro desta fatia é que não existe até a aprovação.
   */
  @Post()
  @HttpCode(200)
  async parse(
    @Body() dto: ParseIntentRequestDto,
    @CurrentUser() actor: AuthTokenPayload,
  ): Promise<IntentApiResult> {
    return this.parseIntentUseCase.execute(
      new ParseIntentCommand(dto.text, actor.permissions, actor.modules),
    );
  }

  /** Monta o rascunho. Continua sem gravar — o §2 é explícito: humano grava. */
  @Post('draft')
  @HttpCode(200)
  async draft(
    @Body() dto: BuildDraftRequestDto,
    @CurrentUser() actor: AuthTokenPayload,
  ): Promise<IntentDraft> {
    return this.buildDraftUseCase.execute(
      new BuildIntentDraftCommand(
        dto.command,
        dto.fields as unknown as Record<string, IntentField>,
        actor.permissions,
        actor.modules,
      ),
    );
  }

  /**
   * Aprova e executa. **Único caminho de escrita.**
   *
   * Tudo o que identifica o ator — conta, usuário, permissões, módulos — vem do TOKEN, nunca do corpo.
   * O corpo traz só o que o operador preencheu. Aceitar `accountId` do corpo permitiria a um usuário
   * autenticado escrever na conta de outro com um id perfeitamente legítimo, e RLS não protege contra
   * isso: a policy confia no escopo que a aplicação estabelece.
   */
  @Post('approve')
  @HttpCode(200)
  async approve(
    @Body() dto: ApproveIntentRequestDto,
    @CurrentUser() actor: AuthTokenPayload,
  ): Promise<ApproveIntentResult> {
    try {
      return await this.approveIntentUseCase.execute(
        new ApproveIntentCommand(
          dto.draftId,
          dto.command,
          dto.fields as unknown as Record<string, IntentField>,
          actor.accountId,
          actor.sub,
          actor.permissions,
          actor.modules,
        ),
      );
    } catch (error) {
      // Um `catch` só, com o comando e o ator no log e sem o conteúdo dos campos — eles podem conter
      // dado de negócio do cliente. O erro segue para o GlobalExceptionFilter.
      this.logger.error('Falha ao aprovar intenção', {
        command: dto.command,
        draftId: dto.draftId,
        actingUserId: actor.sub,
      });
      throw error;
    }
  }
}
