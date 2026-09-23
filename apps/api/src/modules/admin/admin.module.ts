import { Module } from '@nestjs/common';
import { AdminOpsService } from './admin-ops.service';
import { AdminOpsController } from './admin-ops.controller';
import { SupportController } from './support.controller';
import { AdminSeedService } from './admin-seed.service';
import { LedgerModule } from '../ledger/ledger.module';
import { AdminGuard } from '../../common/guards/admin.guard';

@Module({
  imports: [LedgerModule],
  providers: [AdminOpsService, AdminSeedService, AdminGuard],
  controllers: [AdminOpsController, SupportController],
  exports: [AdminOpsService],
})
export class AdminModule {}
