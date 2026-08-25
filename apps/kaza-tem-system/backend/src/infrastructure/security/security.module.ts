import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PASSWORD_HASHER } from './ports/password-hasher.port';
import { TOKEN_SERVICE } from './ports/token-service.port';
import { BcryptPasswordHasher } from './bcrypt-password-hasher.service';
import { JwtTokenService } from './jwt-token.service';
import { SupabaseAuthService } from './supabase-auth.service';
import { AdminGuard } from './guards/admin.guard';
import { ResellerGuard } from './guards/reseller.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: PASSWORD_HASHER,
      useClass: BcryptPasswordHasher,
    },
    {
      provide: TOKEN_SERVICE,
      useClass: JwtTokenService,
    },
    SupabaseAuthService,
    AdminGuard,
    ResellerGuard,
    JwtAuthGuard,
  ],
  exports: [
    PASSWORD_HASHER,
    TOKEN_SERVICE,
    SupabaseAuthService,
    AdminGuard,
    ResellerGuard,
    JwtAuthGuard,
  ],
})
export class SecurityModule {}
