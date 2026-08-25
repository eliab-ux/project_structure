import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'minio';
import { FileStoragePort, PutObjectInput, StoredObjectRef } from './ports/file-storage.port';
import { StorageNotConfiguredException } from './storage-not-configured.exception';

const DEFAULT_SIGNED_URL_TTL_SECONDS = 300;

/** MinIO bucket naming rules: 3–63 chars, lowercase letters, digits, hyphen and dot. */
const VALID_BUCKET_NAME = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;

/**
 * MinIO adapter. One bucket per account (`{MINIO_BUCKET_PREFIX}{account_id}`), created on
 * demand — a tenant's objects never share a bucket with another tenant's.
 *
 * Credentials come exclusively from the environment. They are optional at boot so the app
 * starts without storage configured; the first call fails with an explicit message instead.
 */
@Injectable()
export class MinioFileStorage implements FileStoragePort, OnModuleInit {
  private readonly logger = new Logger(MinioFileStorage.name);
  private client?: Client;
  /** Buckets already known to exist — avoids a round-trip per upload. */
  private readonly ensuredBuckets = new Set<string>();
  private readonly bucketPrefix: string;

  constructor(private readonly config: ConfigService) {
    this.bucketPrefix = this.config.get<string>('MINIO_BUCKET_PREFIX') ?? 'batuta-';
  }

  onModuleInit(): void {
    const endPoint = this.config.get<string>('MINIO_ENDPOINT');
    const accessKey = this.config.get<string>('MINIO_ACCESS_KEY');
    const secretKey = this.config.get<string>('MINIO_SECRET_KEY');

    if (!endPoint || !accessKey || !secretKey) {
      // Not an error: storage is simply not configured in this environment.
      this.logger.warn('MinIO não configurado — uploads falharão até definir MINIO_* no .env');
      return;
    }

    this.client = new Client({
      endPoint,
      port: Number(this.config.get<number>('MINIO_PORT') ?? 9000),
      useSSL: this.config.get<boolean>('MINIO_USE_SSL') ?? true,
      accessKey,
      secretKey,
    });
  }

  /** Bucket for a tenant. Validates the derived name — never interpolates unchecked input. */
  bucketFor(accountId: string): string {
    const bucket = `${this.bucketPrefix}${accountId}`.toLowerCase();
    if (!VALID_BUCKET_NAME.test(bucket)) {
      throw new Error('Identificador de conta inválido para nome de bucket.');
    }
    return bucket;
  }

  async putObject(input: PutObjectInput): Promise<StoredObjectRef> {
    const client = this.requireClient();
    const bucket = this.bucketFor(input.accountId);

    await this.ensureBucket(bucket);
    await client.putObject(bucket, input.key, input.body, input.body.length, {
      'Content-Type': input.mimeType,
    });

    return { bucket, key: input.key };
  }

  async getObject(accountId: string, key: string): Promise<Buffer> {
    const client = this.requireClient();
    const bucket = this.bucketFor(accountId);

    const stream = await client.getObject(bucket, key);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array));
    }
    return Buffer.concat(chunks);
  }

  async copyObject(input: {
    accountId: string;
    sourceKey: string;
    destinationKey: string;
  }): Promise<StoredObjectRef> {
    const client = this.requireClient();
    const bucket = this.bucketFor(input.accountId);

    // Mesmo bucket na origem e no destino: a cópia é sempre DENTRO da conta. Não existe caminho aqui
    // que copie objeto de um tenant para outro, e isso é intencional.
    await this.ensureBucket(bucket);
    await client.copyObject(bucket, input.destinationKey, `/${bucket}/${input.sourceKey}`);

    return { bucket, key: input.destinationKey };
  }

  async getSignedUrl(
    accountId: string,
    key: string,
    expiresInSeconds: number = DEFAULT_SIGNED_URL_TTL_SECONDS,
  ): Promise<string> {
    const client = this.requireClient();
    const bucket = this.bucketFor(accountId);
    return client.presignedGetObject(bucket, key, expiresInSeconds);
  }

  private async ensureBucket(bucket: string): Promise<void> {
    if (this.ensuredBuckets.has(bucket)) {
      return;
    }
    const client = this.requireClient();
    if (!(await client.bucketExists(bucket))) {
      await client.makeBucket(bucket);
    }
    this.ensuredBuckets.add(bucket);
  }

  private requireClient(): Client {
    if (!this.client) {
      // Exceção tipada, não `Error` solto: o filtro global transformaria um `Error` em "Erro interno.
      // Tente novamente." — e tentar de novo nunca resolve variável de ambiente ausente.
      throw new StorageNotConfiguredException();
    }
    return this.client;
  }
}
