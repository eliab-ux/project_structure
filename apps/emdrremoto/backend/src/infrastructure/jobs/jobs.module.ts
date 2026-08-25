import { Module } from '@nestjs/common';
import { SessionModule } from '../../contexts/session/session.module';
import { SessionCleanupTask } from './session-cleanup.task';

@Module({
  imports: [SessionModule],
  providers: [SessionCleanupTask],
})
export class JobsModule {}
