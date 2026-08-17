import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TOKEN_SERVICE } from '../../contexts/auth/application/ports/output/token-service.port';
import { PASSWORD_HASHER } from '../../contexts/user/application/ports/output/password-hasher.port';
import { JwtTokenService } from './jwt-token.service';
import { BcryptPasswordHasher } from './bcrypt-password-hasher.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AdminGuard } from './guards/admin.guard';
import { OwnerGuard } from './guards/owner.guard';
import { ModelistaGuard } from './guards/modelista.guard';

/**
 * Global porque os guards são instanciados pelo container em qualquer controller do app — sem
 * isso, cada módulo HTTP precisaria reimportar SecurityModule só para poder escrever
 * `@UseGuards(AdminGuard)`, e o primeiro esquecimento vira uma rota sem proteção.
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    { provide: TOKEN_SERVICE, useClass: JwtTokenService },
    { provide: PASSWORD_HASHER, useClass: BcryptPasswordHasher },
    JwtAuthGuard,
    AdminGuard,
    OwnerGuard,
    ModelistaGuard,
  ],
  exports: [TOKEN_SERVICE, PASSWORD_HASHER, JwtAuthGuard, AdminGuard, OwnerGuard, ModelistaGuard],
})
export class SecurityModule {}
