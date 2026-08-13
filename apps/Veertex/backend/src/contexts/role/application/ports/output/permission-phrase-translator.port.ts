import { PermissionVerdict } from '../../../domain/permission-phrase';

export const PERMISSION_PHRASE_TRANSLATOR = Symbol('PERMISSION_PHRASE_TRANSLATOR');

export interface PermissionPhraseRequest {
  /** O texto do operador, cru. */
  phrase: string;
  /** As linhas já quebradas — o tradutor cita trechos, e a tela precisa ligá-los às linhas. */
  lines: readonly string[];
  /** O catálogo INTEIRO de permissões que existem. O tradutor não pode propor nada fora daqui. */
  catalogue: readonly string[];
}

/**
 * Traduz uma frase em vereditos de permissão. **Não decide nada, não grava nada.**
 *
 * O port existe pela mesma razão do `IntentParserPort`: a tradução é a única parte do caminho que
 * depende de um fornecedor externo, e ela fica atrás de uma interface para que trocar de provedor
 * seja trocar um adapter. E, como lá, **traduzir não é autorizar** — quem grava é o
 * `UpdateRoleUseCase`, pela mesma rota e pelo mesmo guard de sempre (§8: *"a IA não é caminho
 * paralelo de autorização"*).
 *
 * O contrato devolve vereditos PARCIAIS de propósito: o tradutor fala só do que a frase disse. O
 * silêncio é completado pelo domínio (`completeWithUndecided`), nunca pelo adapter — se cada
 * adapter completasse por conta própria, "o que fazer com o silêncio" teria duas implementações e
 * uma delas ficaria para trás.
 */
export interface PermissionPhraseTranslatorPort {
  /** Lança se o canal não estiver configurado — antes de gastar o tempo do operador. */
  ensureAvailable(): void;

  translate(request: PermissionPhraseRequest): Promise<PermissionVerdict[]>;
}
