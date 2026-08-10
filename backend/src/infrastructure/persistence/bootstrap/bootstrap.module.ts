import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseBootstrapService } from './database-bootstrap.service';

/**
 * Deliberately depends on nothing but ConfigModule.
 *
 * The bootstrap opens its own owner connection and must be able to run even when the application's
 * own persistence layer cannot connect yet — which is precisely the state a fresh database is in
 * before the first migration.
 */
@Module({
  imports: [ConfigModule],
  providers: [DatabaseBootstrapService],
})
export class BootstrapModule {}
