import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Magis5Client } from './magis5.client';
import { Magis5Service } from './magis5.service';
import { MAGIS5_CLIENT } from './magis5-client.port';

@Module({
  imports: [ConfigModule],
  providers: [
    Magis5Client,
    Magis5Service,
    {
      provide: MAGIS5_CLIENT,
      useClass: Magis5Client,
    },
  ],
  exports: [Magis5Service, MAGIS5_CLIENT],
})
export class Magis5Module {}
