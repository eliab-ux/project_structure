import { ValueObject } from '@gitspread/domain-primitives';

/** Numeração de código: digitada pelo operador (`manual`) ou gerada pelo sistema (`sequential`). */
export type CodeNumberingMode = 'manual' | 'sequential';

export const CODE_NUMBERING_MODES: readonly CodeNumberingMode[] = ['manual', 'sequential'];

export interface AccountPreferencesProps {
  /**
   * Permitir dois cadastros com o mesmo CPF/CNPJ na conta (§3.4). Default **não permitir** — decisão
   * de Eliab (14/08/2026), o comportamento conservador (ver `DuplicateContactDocumentException`).
   */
  allowDuplicateDocument: boolean;
  /** Numeração do código do contato (§3.4). Default **manual**. */
  contactCodeMode: CodeNumberingMode;
  /** Numeração do SKU do produto (§3.5). Default **manual**. */
  productSkuMode: CodeNumberingMode;
  /**
   * Carteirização (§2.3 do 02): quando LIGADA, um vendedor sem `contacts.read.all` vê só os contatos
   * da própria carteira. Default **desligada** — ligar muda visibilidade de dado e é decisão da
   * conta. O filtro é RLS, resolvido por request (ADR-0007), nunca no token.
   */
  contactCarteirizacao: boolean;
  /**
   * Estoque negativo permitido (§3.2 do 03). Default **desligado** — bloquear evita vender o que não
   * existe. Ligar é decisão explícita da conta (venda com mercadoria a caminho, divergência de
   * inventário).
   */
  stockAllowNegative: boolean;
}

/**
 * As preferências da conta — as constantes que hoje moram no código (§1 do 01A), agora DECLARADAS.
 *
 * ## Colunas nomeadas, não jsonb (recomendação do §1 do 01A, seguida)
 *
 * Preferência é regra de negócio, não configuração livre: o conjunto é pequeno e estável, e uma
 * coluna nomeada torna cada preferência legível no schema, tipada e validável. jsonb daria
 * flexibilidade que não é pedida e tiraria a validação do banco. Migrar para jsonb depois é barato;
 * o inverso não.
 *
 * ## O default é DECLARADO em código, nunca inferido de ausência (§1 do 01A)
 *
 * `DEFAULTS` é a fonte. `create(undefined)` devolve os defaults; `create({ ...parcial })` sobrepõe só
 * o que veio. Uma conta antiga cujo `contact_code_mode` viesse nulo do banco NÃO herda "o que fizer
 * sentido" — herda o default escrito aqui, e `git blame` responde quem o escolheu.
 *
 * ## Carteirização está FORA de propósito (§1 do 01A, decisão registrada)
 *
 * Não há preferência de carteirização aqui. Ela "permanece fora até VND/ROT" porque é filtro de
 * visibilidade de dado, e meia implementação (uma coluna sem o filtro que a aplica) é a família da
 * coluna inerte que este projeto recusa — alguém depois supõe que ela restringe algo. Volta inteira,
 * com o filtro pelo `sub` do token, junto com o módulo que precisar dela.
 */
export class AccountPreferences extends ValueObject<AccountPreferencesProps> {
  static readonly DEFAULTS: AccountPreferencesProps = {
    allowDuplicateDocument: false,
    contactCodeMode: 'manual',
    productSkuMode: 'manual',
    contactCarteirizacao: false,
    stockAllowNegative: false,
  };

  private constructor(props: AccountPreferencesProps) {
    super(props);
  }

  static defaults(): AccountPreferences {
    return new AccountPreferences({ ...AccountPreferences.DEFAULTS });
  }

  /** Constrói a partir de um parcial, preenchendo o ausente com o default DECLARADO. */
  static create(partial?: Partial<AccountPreferencesProps>): AccountPreferences {
    return new AccountPreferences({
      allowDuplicateDocument:
        partial?.allowDuplicateDocument ?? AccountPreferences.DEFAULTS.allowDuplicateDocument,
      contactCodeMode: normalizeMode(
        partial?.contactCodeMode,
        AccountPreferences.DEFAULTS.contactCodeMode,
      ),
      productSkuMode: normalizeMode(
        partial?.productSkuMode,
        AccountPreferences.DEFAULTS.productSkuMode,
      ),
      contactCarteirizacao:
        partial?.contactCarteirizacao ?? AccountPreferences.DEFAULTS.contactCarteirizacao,
      stockAllowNegative:
        partial?.stockAllowNegative ?? AccountPreferences.DEFAULTS.stockAllowNegative,
    });
  }

  /** Um novo VO com as mudanças aplicadas — imutável, como todo Value Object. */
  with(changes: Partial<AccountPreferencesProps>): AccountPreferences {
    return AccountPreferences.create({ ...this.props, ...changes });
  }

  get allowDuplicateDocument(): boolean {
    return this.props.allowDuplicateDocument;
  }
  get contactCodeMode(): CodeNumberingMode {
    return this.props.contactCodeMode;
  }
  get productSkuMode(): CodeNumberingMode {
    return this.props.productSkuMode;
  }
  get contactCarteirizacao(): boolean {
    return this.props.contactCarteirizacao;
  }
  get stockAllowNegative(): boolean {
    return this.props.stockAllowNegative;
  }
}

function normalizeMode(value: unknown, fallback: CodeNumberingMode): CodeNumberingMode {
  return value === 'manual' || value === 'sequential' ? value : fallback;
}
