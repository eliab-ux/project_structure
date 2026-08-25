import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  USER_REPOSITORY,
  UserRepositoryPort,
} from '../../../../user/application/ports/output/user-repository.port';
import { SupabaseAuthService } from '@infrastructure/security/supabase-auth.service';

export interface SyncResult {
  total: number;
  synced: number;
  skipped: number;
  failed: number;
  details: {
    email: string;
    status: 'synced' | 'skipped' | 'failed';
    reason?: string;
  }[];
}

@Injectable()
export class SyncUsersToSupabaseUseCase implements UseCase<void, SyncResult> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
    private readonly supabaseAuthService: SupabaseAuthService,
  ) {}

  async execute(): Promise<SyncResult> {
    const users = await this.userRepository.findAll();

    const result: SyncResult = {
      total: users.length,
      synced: 0,
      skipped: 0,
      failed: 0,
      details: [],
    };

    for (const user of users) {
      try {
        // Gera uma senha temporária que o usuário deverá resetar
        const tempPassword = this.generateTempPassword();

        await this.supabaseAuthService.createUserWithId(
          user.id.value,
          user.email.value,
          tempPassword,
          { name: user.name },
        );

        result.synced++;
        result.details.push({
          email: user.email.value,
          status: 'synced',
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Se o usuário já existe no Supabase, consideramos como "skipped"
        if (
          errorMessage.toLowerCase().includes('already') ||
          errorMessage.toLowerCase().includes('duplicate')
        ) {
          result.skipped++;
          result.details.push({
            email: user.email.value,
            status: 'skipped',
            reason: 'Usuário já existe no Supabase',
          });
        } else {
          result.failed++;
          result.details.push({
            email: user.email.value,
            status: 'failed',
            reason: errorMessage,
          });
        }
      }
    }

    return result;
  }

  private generateTempPassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    let password = '';
    for (let i = 0; i < 16; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }
}
