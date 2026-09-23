import { Module } from '@nestjs/common';
import { LedgerService } from './ledger.service';
import { WalletsService } from './wallets.service';
import { WalletsController } from './wallets.controller';

@Module({
  providers: [LedgerService, WalletsService],
  controllers: [WalletsController],
  exports: [LedgerService, WalletsService],
})
export class LedgerModule {}
