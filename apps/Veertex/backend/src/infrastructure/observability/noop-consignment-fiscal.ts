import { Injectable } from '@nestjs/common';
import { ConsignmentFiscalPort } from '../../contexts/route/application/ports/output/consignment-fiscal.port';

/**
 * Adapter no-op da fronteira ROT↔FIS. O FIS não existe: a consignação opera SEM documento fiscal
 * (fronteira declarada, 07 §2). Quando o FIS entrar, troca-se este provider por um que chama o
 * `FiscalDocumentPort` com as naturezas do 07 §1.3 — nenhuma assinatura muda.
 */
@Injectable()
export class NoopConsignmentFiscal implements ConsignmentFiscalPort {
  async emitConsignmentShipment(): Promise<string | null> {
    return null;
  }
  async emitConsignedSale(): Promise<string | null> {
    return null;
  }
  async emitConsignmentReturn(): Promise<string | null> {
    return null;
  }
}
