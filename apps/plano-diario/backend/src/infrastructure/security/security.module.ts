import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AesTokenCrypto } from './aes-token-crypto.service';
import { BcryptPasswordHasher } from './bcrypt-password-hasher.service';
import { AdminGuard } from './guards/admin.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtTokenService } from './jwt-token.service';
import { PASSWORD_HASHER } from './ports/password-hasher.port';
import { TOKEN_CRYPTO } from './ports/token-crypto.port';
import { TOKEN_SERVICE } from './ports/token-service.port';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    { provide: PASSWORD_HASHER, useClass: BcryptPasswordHasher },
    { provide: TOKEN_SERVICE, useClass: JwtTokenService },
    { provide: TOKEN_CRYPTO, useClass: AesTokenCrypto },
    JwtAuthGuard,
    AdminGuard,
  ],
  exports: [PASSWORD_HASHER, TOKEN_SERVICE, TOKEN_CRYPTO, JwtAuthGuard, AdminGuard],
})
export class SecurityModule {}
