import { Module } from '@nestjs/common';
import { UserModule } from '../../contexts/user/user.module';
import { UserController } from './controllers/user/user.controller';

@Module({
  imports: [UserModule],
  controllers: [UserController],
})
export class HttpModule {}
