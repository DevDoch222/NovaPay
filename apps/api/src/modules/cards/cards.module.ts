import { Module } from '@nestjs/common';
import { CardsService } from './cards.service';
import { CardsController } from './cards.controller';
import { MockCardIssuer } from './mock-card-issuer';
import { LedgerModule } from '../ledger/ledger.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ComplianceModule } from '../compliance/compliance.module';

@Module({
  imports: [LedgerModule, NotificationsModule, ComplianceModule],
  providers: [CardsService, MockCardIssuer],
  controllers: [CardsController],
  exports: [CardsService],
})
export class CardsModule {}
