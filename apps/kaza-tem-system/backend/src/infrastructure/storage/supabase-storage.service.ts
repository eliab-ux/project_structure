import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseStorageService {
  private readonly logger = new Logger(SupabaseStorageService.name);
  private readonly supabase: SupabaseClient;

  constructor(private readonly configService: ConfigService) {
    const url = this.configService.get<string>('SUPABASE_URL');
    const key = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');

    if (!url || !key) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured');
    }

    this.supabase = createClient(url, key);
  }

  async uploadFile(bucket: string, path: string, file: Buffer, contentType: string): Promise<string> {
    const { error } = await this.supabase.storage
      .from(bucket)
      .upload(path, file, { contentType, upsert: true });

    if (error) {
      this.logger.error('Supabase upload error', error);
      throw new Error(`Falha ao enviar arquivo para Supabase: ${error.message}`);
    }

    const { data } = this.supabase.storage.from(bucket).getPublicUrl(path);

    return data.publicUrl;
  }
}
