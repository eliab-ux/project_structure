import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PASSWORD_HASHER } from './ports/password-hasher.port';
import { TOKEN_SERVICE } from './ports/token-service.port';
import { BcryptPasswordHasher } from './bcrypt-password-hasher.service';
import { JwtTokenService } from './jwt-token.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PsicologoGuard } from './guards/psicologo.guard';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    { provide: PASSWORD_HASHER, useClass: BcryptPasswordHasher },
    { provide: TOKEN_SERVICE, useClass: JwtTokenService },
    JwtAuthGuard,
    PsicologoGuard,
  ],
  exports: [PASSWORD_HASHER, TOKEN_SERVICE, JwtAuthGuard, PsicologoGuard],
})
export class SecurityModule {}
