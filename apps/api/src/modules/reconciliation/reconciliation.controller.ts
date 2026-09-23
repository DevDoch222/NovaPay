import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';
import { ReconciliationService } from './reconciliation.service';
import { AdminGuard } from '../../common/guards/admin.guard';

class TriggerReconDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('v1/admin/reconciliation')
export class ReconciliationController {
  constructor(private readonly reconciliation: ReconciliationService) {}

  @Post('run')
  @ApiOperation({
    summary: 'Run on-demand Flutterwave vs ledger reconciliation for a day',
  })
  run(@Body() dto: TriggerReconDto) {
    return this.reconciliation.reconcileDate(dto.date);
  }

  @Get('report/:date')
  @ApiOperation({ summary: 'Get cached reconciliation report (YYYY-MM-DD)' })
  async report(@Param('date') date: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException('date must be YYYY-MM-DD');
    }
    const cached = await this.reconciliation.getCachedReport(date);
    if (cached) return cached;
    return this.reconciliation.reconcileDate(date);
  }
}
