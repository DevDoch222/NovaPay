import {
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
  MinLength,
} from 'class-validator';
import { AdminOpsService } from './admin-ops.service';
import { AdminGuard } from '../../common/guards/admin.guard';
import {
  AdminRoles,
  CurrentUser,
  type AuthUser,
} from '../../common/decorators';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';

class AdminUserSearchQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Phone, tag, email, or user id' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  q?: string;
}

class AdminTxnSearchQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(128)
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  type?: string;
}

class AdminTicketListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  userId?: string;
}

class SetStatusDto {
  @IsIn(['active', 'suspended', 'closed'])
  status!: 'active' | 'suspended' | 'closed';
}

class SetRoleDto {
  @IsIn(['customer', 'support', 'admin'])
  platformRole!: 'customer' | 'support' | 'admin';
}

class CreateTicketDto {
  @IsUUID()
  userId!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(255)
  subject!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body!: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  priority?: string;

  @IsOptional()
  @IsUUID()
  relatedTransactionId?: string;
}

class ReplyTicketDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body!: string;

  @IsOptional()
  @IsIn(['open', 'in_progress', 'waiting_customer', 'resolved', 'closed'])
  status?:
    | 'open'
    | 'in_progress'
    | 'waiting_customer'
    | 'resolved'
    | 'closed';
}

class UpdateTicketDto {
  @IsIn(['open', 'in_progress', 'waiting_customer', 'resolved', 'closed'])
  status!:
    | 'open'
    | 'in_progress'
    | 'waiting_customer'
    | 'resolved'
    | 'closed';
}

class AdminKycListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ['pending', 'approved', 'rejected'] })
  @IsOptional()
  @IsIn(['pending', 'approved', 'rejected'])
  status?: 'pending' | 'approved' | 'rejected';
}

class ReviewKycDto {
  @IsIn(['approve', 'reject'])
  decision!: 'approve' | 'reject';

  @IsOptional()
  @IsIn(['tier_1', 'tier_2'])
  kycTier?: 'tier_1' | 'tier_2';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('v1/admin')
export class AdminOpsController {
  constructor(private readonly ops: AdminOpsService) {}

  @Get('kyc')
  @ApiOperation({ summary: 'List KYC submissions for manual review' })
  listKyc(@Query() query: AdminKycListQueryDto) {
    return this.ops.listKyc({
      status: query.status,
      page: query.page,
      limit: query.limit,
    });
  }

  @Post('kyc/:id/review')
  @ApiOperation({
    summary: 'Approve or reject a pending KYC (sets tier on approve)',
  })
  reviewKyc(
    @CurrentUser() staff: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewKycDto,
  ) {
    return this.ops.reviewKyc({
      recordId: id,
      decision: dto.decision,
      kycTier: dto.kycTier,
      reason: dto.reason,
      actorUserId: staff.userId,
    });
  }

  @Get('users')
  @ApiOperation({ summary: 'Search customers' })
  searchUsers(@Query() query: AdminUserSearchQueryDto) {
    return this.ops.searchUsers(query.q, query.page, query.limit);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Customer profile, wallets, recent txns' })
  getUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.ops.getUser(id);
  }

  @Patch('users/:id/status')
  @ApiOperation({ summary: 'Activate / suspend / close customer' })
  setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetStatusDto,
  ) {
    return this.ops.setUserStatus(id, dto.status);
  }

  @Patch('users/:id/role')
  @AdminRoles('admin')
  @ApiOperation({ summary: 'Set platform role (admin only)' })
  setRole(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetRoleDto) {
    return this.ops.setPlatformRole(id, dto.platformRole);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Search / track transactions' })
  searchTxns(@Query() query: AdminTxnSearchQueryDto) {
    return this.ops.searchTransactions({
      q: query.q,
      userId: query.userId,
      status: query.status,
      type: query.type,
      page: query.page,
      limit: query.limit,
    });
  }

  @Get('transactions/:id')
  @ApiOperation({ summary: 'Transaction detail + ledger legs' })
  getTxn(@Param('id', ParseUUIDPipe) id: string) {
    return this.ops.getTransaction(id);
  }

  @Get('support/tickets')
  @ApiOperation({ summary: 'List support tickets' })
  listTickets(@Query() query: AdminTicketListQueryDto) {
    return this.ops.listTickets({
      status: query.status,
      userId: query.userId,
      page: query.page,
      limit: query.limit,
    });
  }

  @Post('support/tickets')
  @ApiOperation({ summary: 'Open a ticket on behalf of a customer' })
  createTicket(@CurrentUser() staff: AuthUser, @Body() dto: CreateTicketDto) {
    return this.ops.createTicket({
      userId: dto.userId,
      subject: dto.subject,
      body: dto.body,
      category: dto.category,
      priority: dto.priority,
      relatedTransactionId: dto.relatedTransactionId,
      isStaff: true,
      authorUserId: staff.userId,
    });
  }

  @Get('support/tickets/:id')
  getTicket(@Param('id', ParseUUIDPipe) id: string) {
    return this.ops.getTicket(id);
  }

  @Post('support/tickets/:id/messages')
  reply(
    @CurrentUser() staff: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplyTicketDto,
  ) {
    return this.ops.replyTicket({
      ticketId: id,
      authorUserId: staff.userId,
      body: dto.body,
      isStaff: true,
      status: dto.status,
    });
  }

  @Patch('support/tickets/:id')
  updateTicket(
    @CurrentUser() staff: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTicketDto,
  ) {
    return this.ops.updateTicketStatus(id, dto.status, staff.userId);
  }
}
