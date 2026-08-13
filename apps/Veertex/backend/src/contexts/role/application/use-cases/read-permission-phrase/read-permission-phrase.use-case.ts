import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@veertex/shared-kernel';
import {
  PERMISSION_PHRASE_TRANSLATOR,
  PermissionPhraseTranslatorPort,
} from '../../ports/output/permission-phrase-translator.port';
import {
  completeWithUndecided,
  PermissionPhraseReading,
  splitPhraseIntoLines,
} from '../../../domain/permission-phrase';
import { ALL_PERMISSIONS } from '../../../domain/permissions.catalog';

export class ReadPermissionPhraseQuery {
  constructor(public readonly phrase: string) {}
}

/**
 * Lê uma frase e devolve a tradução em permissões. **Não grava nada. Não altera papel nenhum.**
 *
 * É o passo "traduzir" do mesmo desenho de três passos da Mesa: traduzir → conferir → aprovar. A
 * aprovação aqui é o `PATCH /roles/:id` de sempre, com `roles.update` — esta rota não escreve, e é
 * por isso que ela pode existir sem virar um segundo caminho de autorização.
 *
 * **O silêncio é completado aqui**, no domínio, e não no adapter: toda permissão do catálogo volta
 * na resposta, e a que a frase não mencionou volta como `undecided`. É o requisito do §5.1 —
 * *"nunca resolva um silêncio como negado nem como permitido"* — implementado onde nenhum adapter
 * pode contorná-lo.
 *
 * A frase do operador **não vai para log**: ela descreve a organização interna do cliente ("a Ana
 * não pode dar desconto"), e um log dessas frases é um registro de política de pessoal.
 */
@Injectable()
export class ReadPermissionPhraseUseCase implements UseCase<
  ReadPermissionPhraseQuery,
  PermissionPhraseReading
> {
  private readonly logger = new Logger(ReadPermissionPhraseUseCase.name);

  constructor(
    @Inject(PERMISSION_PHRASE_TRANSLATOR)
    private readonly translator: PermissionPhraseTranslatorPort,
  ) {}

  async execute(query: ReadPermissionPhraseQuery): Promise<PermissionPhraseReading> {
    this.translator.ensureAvailable();

    const lines = splitPhraseIntoLines(query.phrase);
    const translated = await this.translator.translate({
      phrase: query.phrase,
      lines,
      catalogue: ALL_PERMISSIONS,
    });

    const verdicts = completeWithUndecided(translated);

    this.logger.log('Frase de permissões traduzida', {
      linhas: lines.length,
      permitidas: verdicts.filter((v) => v.decision === 'granted').length,
      negadas: verdicts.filter((v) => v.decision === 'denied').length,
      aDecidir: verdicts.filter((v) => v.decision === 'undecided').length,
    });

    return { lines, verdicts };
  }
}
