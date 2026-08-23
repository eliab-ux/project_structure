import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { EvidenceStoragePort } from '../../contexts/route/application/ports/output/evidence-storage.port';

/**
 * Adapter no-op do storage de evidências. A dependência `minio` NÃO foi aprovada ainda (gatilho de
 * parada registrado) — este adapter devolve a chave determinística sem gravar o binário. Quando o
 * MinIO entrar, troca-se o provider; as chaves já persistidas continuam válidas (mesmo formato).
 */
@Injectable()
export class NoopEvidenceStorage implements EvidenceStoragePort {
  async store(params: { accountId: string; orderId: string; kind: string }): Promise<string> {
    return `evidence/${params.accountId}/${params.orderId}/${params.kind}-${randomUUID()}`;
  }
}
