import { Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { ResetPasswordCommand } from './reset-password.command';
import { SupabaseAuthService } from '@infrastructure/security/supabase-auth.service';

@Injectable()
export class ResetPasswordUseCase implements UseCase<ResetPasswordCommand, void> {
  constructor(private readonly supabaseAuthService: SupabaseAuthService) {}

  async execute(command: ResetPasswordCommand): Promise<void> {
    await this.supabaseAuthService.updatePassword(command.accessToken, command.newPassword);
  }
}
