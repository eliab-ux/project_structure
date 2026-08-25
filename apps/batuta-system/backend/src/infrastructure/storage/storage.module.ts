import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FILE_STORAGE } from './ports/file-storage.port';
import { MinioFileStorage } from './minio-file-storage.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [{ provide: FILE_STORAGE, useClass: MinioFileStorage }],
  exports: [FILE_STORAGE],
})
export class StorageModule {}
