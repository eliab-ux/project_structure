/**
 * Modelo de comissão do vendedor (§2 do 02A) — atributo do cadastro do usuário.
 *
 * `a` = escala de META (loja/balcão); `b` = escala de RECEBIMENTO (rota, só com o ROT); `none` = não
 * comissiona. **Dormente**: nasce agora (schema pronto, migration barata) mas o gatilho automático
 * no faturamento/acerto só liga com FIN/ROT. Hoje a apuração é sob demanda e valida este atributo.
 */
export const USER_COMMISSION_MODELS = ['none', 'a', 'b'] as const;

export type CommissionModel = (typeof USER_COMMISSION_MODELS)[number];

export const DEFAULT_COMMISSION_MODEL: CommissionModel = 'none';

export function isCommissionModel(value: string): value is CommissionModel {
  return (USER_COMMISSION_MODELS as readonly string[]).includes(value);
}
