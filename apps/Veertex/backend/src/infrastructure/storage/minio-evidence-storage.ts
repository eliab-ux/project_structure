import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { Client } from 'minio';
import { EvidenceStoragePort } from '../../contexts/route/application/ports/output/evidence-storage.port';

/**
 * Adapter REAL do storage de evidências — MinIO (SDK oficial, dependência aprovada 23/08/2026).
 *
 * Organização: **um bucket único** (`MINIO_BUCKET`) com **prefixo por `account_id`** — escolha
 * registrada: bucket por conta exigiria provisionamento por tenant no onboarding e estoura limites
 * de bucket em SaaS; o prefixo isola no caminho e a autorização continua na aplicação (RLS na linha
 * que guarda a chave). Credenciais SÓ via env/Dokploy (CLAUDE.md regra 5) — nunca no repositório.
 *
 * A CHAVE é persistida; a URL **nunca** (montada na leitura, trocar endpoint não migra dados).
 */
@Injectable()
export class MinioEvidenceStorage implements EvidenceStoragePort {
  private readonly logger = new Logger(MinioEvidenceStorage.name);
  private readonly client: Client;
  private readonly bucket: string;
  private bucketChecked = false;

  constructor() {
    this.bucket = process.env.MINIO_BUCKET || 'veertex-evidence';
    this.client = new Client({
      endPoint: process.env.MINIO_ENDPOINT as string,
      port: Number(process.env.MINIO_PORT || 9000),
      useSSL: (process.env.MINIO_USE_SSL ?? 'true') === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY as string,
      secretKey: process.env.MINIO_SECRET_KEY as string,
    });
  }

  async store(params: {
    accountId: string;
    orderId: string;
    kind: string;
    fileBase64: string;
    fileMimeType: string;
  }): Promise<string> {
    await this.ensureBucket();
    // Prefixo por account_id — o isolamento no caminho espelha o isolamento das linhas.
    const key = `evidence/${params.accountId}/${params.orderId}/${params.kind}-${randomUUID()}`;
    const buffer = Buffer.from(params.fileBase64, 'base64');
    await this.client.putObject(this.bucket, key, buffer, buffer.length, {
      'Content-Type': params.fileMimeType,
    });
    return key;
  }

  private async ensureBucket(): Promise<void> {
    if (this.bucketChecked) {
      return;
    }
    const exists = await this.client.bucketExists(this.bucket);
    if (!exists) {
      await this.client.makeBucket(this.bucket);
      this.logger.log('Bucket de evidências criado', { bucket: this.bucket });
    }
    this.bucketChecked = true;
  }
}
