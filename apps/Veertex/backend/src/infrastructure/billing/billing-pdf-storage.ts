import { Injectable, Logger } from '@nestjs/common';
import { Client } from 'minio';
import { BillingPdfStoragePort } from '../../contexts/billing/application/ports/output/billing-support.ports';

/**
 * PDF de boleto → MinIO (mesmo padrão do storage de evidências: bucket único, prefixo por
 * account_id, CHAVE persistida e URL nunca). Sem MINIO_ENDPOINT, o factory do módulo registra o
 * no-op — o boleto continua emitível (linha digitável/QR vêm do provedor); só o PDF não é
 * arquivado, e a chave nula diz isso.
 */
@Injectable()
export class MinioBillingPdfStorage implements BillingPdfStoragePort {
  private readonly logger = new Logger(MinioBillingPdfStorage.name);
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
    chargeId: string;
    pdfBase64: string;
  }): Promise<string> {
    if (!this.bucketChecked) {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket);
        this.logger.log('Bucket criado', { bucket: this.bucket });
      }
      this.bucketChecked = true;
    }
    const key = `billing/${params.accountId}/${params.chargeId}.pdf`;
    const buffer = Buffer.from(params.pdfBase64, 'base64');
    await this.client.putObject(this.bucket, key, buffer, buffer.length, {
      'Content-Type': 'application/pdf',
    });
    return key;
  }
}

@Injectable()
export class NoopBillingPdfStorage implements BillingPdfStoragePort {
  async store(_params: {
    accountId: string;
    chargeId: string;
    pdfBase64: string;
  }): Promise<string> {
    // Dev sem MinIO: a emissão funciona; o PDF não é arquivado e a charge fica com a chave nula.
    return '';
  }
}
