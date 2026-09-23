import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AdminOpsService } from '../admin/admin-ops.service';
import { CurrentUser, type AuthUser } from '../../common/decorators';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

class CustomerCreateTicketDto {
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
  @IsUUID()
  relatedTransactionId?: string;
}

class CustomerReplyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body!: string;
}

class CustomerReopenDto {
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  body?: string;
}

@ApiTags('support')
@ApiBearerAuth()
@Controller('v1/support')
export class SupportController {
  constructor(private readonly ops: AdminOpsService) {}

  @Post('tickets')
  @ApiOperation({ summary: 'Open a support request' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CustomerCreateTicketDto) {
    return this.ops.createTicket({
      userId: user.userId,
      subject: dto.subject,
      body: dto.body,
      category: dto.category,
      relatedTransactionId: dto.relatedTransactionId,
      isStaff: false,
      authorUserId: user.userId,
    });
  }

  @Get('tickets')
  list(@CurrentUser() user: AuthUser, @Query() query: PaginationQueryDto) {
    return this.ops.listTickets({
      userId: user.userId,
      page: query.page,
      limit: query.limit,
    });
  }

  @Get('tickets/:id')
  async get(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const detail = await this.ops.getTicket(id);
    if (detail.ticket.userId !== user.userId) {
      throw new ForbiddenException();
    }
    return detail;
  }

  @Post('tickets/:id/messages')
  async reply(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CustomerReplyDto,
  ) {
    const detail = await this.ops.getTicket(id);
    if (detail.ticket.userId !== user.userId) {
      throw new ForbiddenException();
    }
    const closed =
      detail.ticket.status === 'resolved' || detail.ticket.status === 'closed';
    return this.ops.replyTicket({
      ticketId: id,
      authorUserId: user.userId,
      body: dto.body,
      isStaff: false,
      // Reopen closed tickets so they return to the staff queue
      status: closed ? 'open' : 'in_progress',
    });
  }

  @Post('tickets/:id/reopen')
  @ApiOperation({ summary: 'Reopen a resolved/closed ticket' })
  async reopen(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CustomerReopenDto,
  ) {
    return this.ops.reopenTicket({
      ticketId: id,
      userId: user.userId,
      note: dto.body,
    });
  }
}
