import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { User, Session } from '@supabase/auth-js';

@Injectable()
export class SupabaseAuthService {
  private readonly supabase: SupabaseClient;

  constructor(private readonly configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase URL and service role key must be configured');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }

  async createUser(email: string, password: string, metadata?: { name?: string }): Promise<User> {
    const { data, error } = await this.supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: metadata,
      email_confirm: true,
    });

    if (error) {
      throw error;
    }

    if (!data.user) {
      throw new Error('Supabase did not return a user');
    }

    return data.user;
  }

  async createUserWithId(
    id: string,
    email: string,
    password: string,
    metadata?: { name?: string },
  ): Promise<User> {
    const { data, error } = await this.supabase.auth.admin.createUser({
      id,
      email,
      password,
      user_metadata: metadata,
      email_confirm: true,
    });

    if (error) {
      throw error;
    }

    if (!data.user) {
      throw new Error('Supabase did not return a user');
    }

    return data.user;
  }

  async deleteUser(userId: string): Promise<void> {
    const { error } = await this.supabase.auth.admin.deleteUser(userId);
    if (error) {
      throw error;
    }
  }

  async signIn(email: string, password: string): Promise<{ user: User; session: Session }> {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }

    if (!data.user || !data.session) {
      throw new Error('Supabase login did not return session information');
    }

    return {
      user: data.user,
      session: data.session,
    };
  }

  async resetPassword(email: string): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3003';
    const redirectTo = `${frontendUrl}/auth/reset-password`;

    const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      throw error;
    }
  }

  async updatePassword(accessToken: string, newPassword: string): Promise<void> {
    // First, get the user from the access token
    const { data: userData, error: userError } = await this.supabase.auth.getUser(accessToken);

    if (userError) {
      throw userError;
    }

    if (!userData.user) {
      throw new Error('Token inválido ou expirado');
    }

    // Use admin API to update the user's password
    const { error } = await this.supabase.auth.admin.updateUserById(userData.user.id, {
      password: newPassword,
    });

    if (error) {
      throw error;
    }
  }
}
