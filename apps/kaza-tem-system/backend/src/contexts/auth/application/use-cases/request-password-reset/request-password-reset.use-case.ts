import { Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { RequestPasswordResetCommand } from './request-password-reset.command';
import { Email } from '@contexts/user/domain/value-objects/email.vo';
import { SupabaseAuthService } from '@infrastructure/security/supabase-auth.service';

@Injectable()
export class RequestPasswordResetUseCase implements UseCase<RequestPasswordResetCommand, void> {
  constructor(private readonly supabaseAuthService: SupabaseAuthService) {}

  async execute(command: RequestPasswordResetCommand): Promise<void> {
    const email = Email.create(command.email);
    await this.supabaseAuthService.resetPassword(email.value);
  }
}
