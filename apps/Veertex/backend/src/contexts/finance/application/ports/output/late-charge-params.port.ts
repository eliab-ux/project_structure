import { LateChargeParams } from '../../../domain/late-charges';

export const LATE_CHARGE_PARAMS = Symbol('LATE_CHARGE_PARAMS');

/** Lê os parâmetros de juros/multa da CONTA atual (§2.1 do 05). Escopado pelo tenant. */
export interface LateChargeParamsPort {
  forCurrentAccount(): Promise<LateChargeParams>;
}
