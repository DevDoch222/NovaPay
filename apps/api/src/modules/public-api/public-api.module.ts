import { Module } from '@nestjs/common';
import { PublicApiService } from './public-api.service';
import { PublicApiController } from './public-api.controller';
import { LedgerModule } from '../ledger/ledger.module';

@Module({
  imports: [LedgerModule],
  providers: [PublicApiService],
  controllers: [PublicApiController],
  exports: [PublicApiService],
})
export class PublicApiModule {}
