import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { AmlMonitorService } from './aml-monitor.service';
import { DisputeService } from './dispute.service';
import { RetentionService } from './retention.service';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { buildPaginatedResult } from '../../common/api/pagination.util';
import { AdminGuard } from '../../common/guards/admin.guard';
import { AdminRoles } from '../../common/decorators';
import { ApiPropertyOptional } from '@nestjs/swagger';

class UpdateAlertDto {
  @IsIn(['open', 'under_review', 'dismissed', 'confirmed'])
  status!: 'open' | 'under_review' | 'dismissed' | 'confirmed';
}

class ResolveDisputeDto {
  @IsIn(['won', 'lost'])
  outcome!: 'won' | 'lost';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  resolutionNote?: string;
}

class PurgeUserDto {
  @IsUUID()
  userId!: string;
}

class AdminAlertsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('v1/admin/compliance')
export class ComplianceAdminController {
  constructor(
    private readonly aml: AmlMonitorService,
    private readonly disputes: DisputeService,
    private readonly retention: RetentionService,
  ) {}

  @Get('alerts')
  @ApiOperation({ summary: 'List AML / compliance alerts' })
  async listAlerts(@Query() query: AdminAlertsQueryDto) {
    const items = await this.aml.listAlerts(
      query.status,
      query.page,
      query.limit,
    );
    return buildPaginatedResult(
      items,
      query.page ?? 1,
      query.limit ?? 50,
      items.length,
    );
  }

  @Patch('alerts/:id')
  @ApiOperation({ summary: 'Update compliance alert status' })
  async updateAlert(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAlertDto,
  ) {
    const row = await this.aml.updateAlert(id, dto.status);
    if (!row) throw new BadRequestException('Alert not found');
    return row;
  }

  @Post('disputes/:id/resolve')
  @ApiOperation({ summary: 'Resolve card dispute (won reverses ledger)' })
  resolveDispute(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveDisputeDto,
  ) {
    return this.disputes.resolve({
      disputeId: id,
      outcome: dto.outcome,
      resolutionNote: dto.resolutionNote,
    });
  }

  @Post('retention/purge')
  @AdminRoles('admin')
  @ApiOperation({ summary: 'NDPR stub — redact PII for closed user' })
  purge(@Body() dto: PurgeUserDto) {
    return this.retention.purgeClosedUser(dto.userId);
  }
}
