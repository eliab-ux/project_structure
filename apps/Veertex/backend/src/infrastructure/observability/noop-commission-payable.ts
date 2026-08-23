import { Injectable } from '@nestjs/common';
import { CommissionPayablePort } from '../../contexts/commission/application/ports/output/commission-payable.port';

/**
 * Adapter no-op do `CommissionPayablePort` (§2 do 02A). O FIN não existe: a comissão apurada não vira
 * conta a pagar ainda. Quando o FIN entrar, troca-se este provider — nada mais muda. Fire-and-forget:
 * nunca lança.
 */
@Injectable()
export class NoopCommissionPayable implements CommissionPayablePort {
  emit(): void {
    // Sem FIN configurado → não faz nada. Não é erro (fronteira declarada).
  }
}
