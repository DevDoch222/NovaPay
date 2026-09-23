import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { ComplianceService } from './compliance.service';
import { DisputeService } from './dispute.service';
import { CurrentUser, type AuthUser } from '../../common/decorators';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { MVP_CURRENCY } from '../../common/constants';

class OpenDisputeDto {
  @IsUUID()
  cardId!: string;

  @IsUUID()
  transactionId!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(255)
  reason!: string;
}

@ApiTags('compliance')
@Controller('v1/compliance')
export class ComplianceController {
  constructor(
    private readonly compliance: ComplianceService,
    private readonly disputes: DisputeService,
  ) {}

  @Get('limits')
  @ApiOperation({ summary: 'KYC tier limits and current period usage' })
  limits(
    @CurrentUser() user: AuthUser,
    @Query('currency') currency?: string,
  ) {
    return this.compliance.getUserLimitsUsage(
      user.userId,
      currency ?? MVP_CURRENCY,
    );
  }

  @Post('disputes')
  @ApiOperation({ summary: 'Open a card dispute' })
  openDispute(@CurrentUser() user: AuthUser, @Body() dto: OpenDisputeDto) {
    return this.disputes.open({
      userId: user.userId,
      cardId: dto.cardId,
      transactionId: dto.transactionId,
      reason: dto.reason,
    });
  }

  @Get('disputes')
  @ApiOperation({ summary: 'List my card disputes' })
  listDisputes(
    @CurrentUser() user: AuthUser,
    @Query() query: PaginationQueryDto,
  ) {
    return this.disputes.listForUser(user.userId, query.page, query.limit);
  }

  @Get('disputes/:id')
  @ApiOperation({ summary: 'Get dispute by id (owner only)' })
  getDispute(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.disputes.getForUser(user.userId, id);
  }
}
