import { Module } from '@nestjs/common';
import { StablecoinsService } from './stablecoins.service';
import { StablecoinsController } from './stablecoins.controller';
import { LedgerModule } from '../ledger/ledger.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [LedgerModule, NotificationsModule],
  providers: [StablecoinsService],
  controllers: [StablecoinsController],
})
export class StablecoinsModule {}
