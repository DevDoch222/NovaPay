import { Module } from '@nestjs/common';
import { ReconciliationService } from './reconciliation.service';
import { ReconciliationController } from './reconciliation.controller';
import { FlutterwaveClient } from '../payments/rails/flutterwave.client';
import { AdminGuard } from '../../common/guards/admin.guard';

@Module({
  providers: [ReconciliationService, FlutterwaveClient, AdminGuard],
  controllers: [ReconciliationController],
  exports: [ReconciliationService],
})
export class ReconciliationModule {}
