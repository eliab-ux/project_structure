import { Module } from '@nestjs/common';
import { UserModule } from '../../contexts/user/user.module';
import { ResellerModule } from '../../contexts/reseller/reseller.module';
import { AuthenticationModule } from '../../contexts/auth/authentication.module';
import { AuthController } from './controllers/auth/auth.controller';
import { AdminAuthController } from './controllers/auth/admin-auth.controller';

@Module({
  imports: [UserModule, ResellerModule, AuthenticationModule],
  controllers: [AuthController, AdminAuthController],
})
export class AuthModule {}
