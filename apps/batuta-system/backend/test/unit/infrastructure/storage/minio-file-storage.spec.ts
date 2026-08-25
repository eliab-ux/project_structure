import { ConfigService } from '@nestjs/config';
import { MinioFileStorage } from '../../../../src/infrastructure/storage/minio-file-storage.service';

function storageWith(env: Record<string, unknown>): MinioFileStorage {
  const config = {
    get: <T>(key: string): T | undefined => env[key] as T | undefined,
  } as ConfigService;
  return new MinioFileStorage(config);
}

const ACCOUNT_ID = '3f6a9c1e-1b5d-4a0e-9c7e-2b8f0d4a1c33';

describe('MinioFileStorage', () => {
  describe('bucketFor', () => {
    it('derives one bucket per account using the configured prefix', () => {
      const storage = storageWith({ MINIO_BUCKET_PREFIX: 'batuta-' });

      expect(storage.bucketFor(ACCOUNT_ID)).toBe(`batuta-${ACCOUNT_ID}`);
    });

    it('rejects an account id that would produce an invalid bucket name', () => {
      const storage = storageWith({ MINIO_BUCKET_PREFIX: 'batuta-' });

      // Defense in depth: the account id comes from the JWT, but the adapter still refuses
      // anything that could smuggle a path or a different bucket into the name.
      expect(() => storage.bucketFor('../other-tenant')).toThrow(/inválido/);
      expect(() => storage.bucketFor('tenant/../../etc')).toThrow(/inválido/);
      expect(() => storage.bucketFor('')).toThrow(/inválido/);
    });
  });

  describe('without credentials', () => {
    it('boots without MinIO configured and fails only at the point of use', async () => {
      const storage = storageWith({});

      expect(() => storage.onModuleInit()).not.toThrow();
      await expect(
        storage.putObject({
          accountId: ACCOUNT_ID,
          key: 'contact-imports/list.csv',
          body: Buffer.from('phone\n5511999999999'),
          mimeType: 'text/csv',
        }),
      ).rejects.toThrow(/MINIO_ENDPOINT/);
      await expect(storage.getSignedUrl(ACCOUNT_ID, 'contact-imports/list.csv')).rejects.toThrow(
        /MINIO_ENDPOINT/,
      );
    });
  });
});
