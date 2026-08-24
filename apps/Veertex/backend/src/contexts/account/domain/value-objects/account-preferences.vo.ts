import { ValueObject } from '@gitspread/domain-primitives';

/** Numeração de código: digitada pelo operador (`manual`) ou gerada pelo sistema (`sequential`). */
export type CodeNumberingMode = 'manual' | 'sequential';

export const CODE_NUMBERING_MODES: readonly CodeNumberingMode[] = ['manual', 'sequential'];

/**
 * Vencimento das comissões materializadas como conta a pagar (registro de 23/08/2026):
 * `last_day_of_period` = último dia do mês apurado (comportamento original, sem breaking);
 * `day_n_next_month` = dia N do mês SEGUINTE (padrão de mercado — folha paga no início do mês).
 */
export type CommissionDueRule = 'last_day_of_period' | 'day_n_next_month';

export const COMMISSION_DUE_RULES: readonly CommissionDueRule[] = [
  'last_day_of_period',
  'day_n_next_month',
];

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
  /** Regra de vencimento das comissões (§2.2 do 05). Default = comportamento original. */
  commissionDueRule: CommissionDueRule;
  /** O dia N da regra `day_n_next_month` (1–28 — 29+ não existe em todo mês). Default 5. */
  commissionDueDay: number;
  /**
   * Bloqueio por inadimplência (06 §2.5): nova venda é BLOQUEADA quando o cliente tem título
   * vencido além de N dias. Default LIGADO com N=30 — o desenho do 06 pede bloqueio por default;
   * a exceção é a permissão granular `orders.overdue.override`, nunca uma preferência frouxa.
   */
  overdueBlockEnabled: boolean;
  overdueBlockDays: number;
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
    commissionDueRule: 'last_day_of_period',
    commissionDueDay: 5,
    overdueBlockEnabled: true,
    overdueBlockDays: 30,
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
      commissionDueRule:
        partial?.commissionDueRule === 'day_n_next_month'
          ? 'day_n_next_month'
          : partial?.commissionDueRule === 'last_day_of_period'
            ? 'last_day_of_period'
            : AccountPreferences.DEFAULTS.commissionDueRule,
      commissionDueDay: clampDueDay(partial?.commissionDueDay),
      overdueBlockEnabled:
        partial?.overdueBlockEnabled ?? AccountPreferences.DEFAULTS.overdueBlockEnabled,
      overdueBlockDays: clampOverdueDays(partial?.overdueBlockDays),
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
  get commissionDueRule(): CommissionDueRule {
    return this.props.commissionDueRule;
  }
  get commissionDueDay(): number {
    return this.props.commissionDueDay;
  }
  get overdueBlockEnabled(): boolean {
    return this.props.overdueBlockEnabled;
  }
  get overdueBlockDays(): number {
    return this.props.overdueBlockDays;
  }
}

/** 0–365: N dias de tolerância do bloqueio por inadimplência. */
function clampOverdueDays(value: unknown): number {
  const days = typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : 30;
  return Math.min(365, Math.max(0, days));
}

/** 1–28: dia 29+ não existe em todo mês, e a regra de vencimento não pode depender do calendário. */
function clampDueDay(value: unknown): number {
  const day = typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : 5;
  return Math.min(28, Math.max(1, day));
}

function normalizeMode(value: unknown, fallback: CodeNumberingMode): CodeNumberingMode {
  return value === 'manual' || value === 'sequential' ? value : fallback;
}
