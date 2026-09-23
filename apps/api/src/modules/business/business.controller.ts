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
import { BusinessService } from './business.service';
import {
  CreateBulkPayoutDto,
  CreateOrganizationDto,
  FundOrgWalletDto,
  InviteMemberDto,
} from './dto';
import { CurrentUser, type AuthUser } from '../../common/decorators';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

@ApiTags('business')
@Controller('v1/business')
export class BusinessController {
  constructor(private readonly business: BusinessService) {}

  @Post('organizations')
  @ApiOperation({ summary: 'Create organization' })
  createOrg(@CurrentUser() user: AuthUser, @Body() dto: CreateOrganizationDto) {
    return this.business.createOrganization(user.userId, dto);
  }

  @Get('organizations')
  @ApiOperation({ summary: 'List organizations (paginated)' })
  listOrgs(@CurrentUser() user: AuthUser, @Query() query: PaginationQueryDto) {
    return this.business.listOrganizations(
      user.userId,
      query.page,
      query.limit,
    );
  }

  @Post('organizations/:orgId/members')
  @ApiOperation({ summary: 'Invite organization member' })
  invite(
    @CurrentUser() user: AuthUser,
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Body() dto: InviteMemberDto,
  ) {
    return this.business.inviteMember(user.userId, orgId, {
      userId: dto.userId,
      phone: dto.phone,
      tag: dto.tag,
      role: dto.role,
    });
  }

  @Get('organizations/:orgId/members')
  @ApiOperation({ summary: 'List organization members (paginated)' })
  members(
    @CurrentUser() user: AuthUser,
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.business.listMembers(
      user.userId,
      orgId,
      query.page,
      query.limit,
    );
  }

  @Get('organizations/:orgId/wallet')
  @ApiOperation({ summary: 'Get organization wallet balance' })
  wallet(
    @CurrentUser() user: AuthUser,
    @Param('orgId', ParseUUIDPipe) orgId: string,
  ) {
    return this.business.getOrgWalletBalance(user.userId, orgId);
  }

  @Post('organizations/:orgId/wallet/fund')
  @ApiOperation({ summary: 'Fund organization wallet (sandbox)' })
  fund(
    @CurrentUser() user: AuthUser,
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Body() dto: FundOrgWalletDto,
  ) {
    return this.business.fundOrgWallet(
      user.userId,
      orgId,
      dto.amountMajor,
      dto.idempotencyKey,
    );
  }

  @Get('organizations/:orgId/bulk-payouts')
  @ApiOperation({ summary: 'List bulk payout batches (paginated)' })
  listBatches(
    @CurrentUser() user: AuthUser,
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.business.listBatches(
      user.userId,
      orgId,
      query.page,
      query.limit,
    );
  }

  @Post('organizations/:orgId/bulk-payouts')
  @ApiOperation({ summary: 'Create bulk payout batch' })
  bulk(
    @CurrentUser() user: AuthUser,
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Body() dto: CreateBulkPayoutDto,
  ) {
    return this.business.createBulkPayout(user.userId, orgId, dto);
  }

  @Post('organizations/:orgId/bulk-payouts/:batchId/approve')
  @ApiOperation({ summary: 'Approve bulk payout batch' })
  approve(
    @CurrentUser() user: AuthUser,
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('batchId', ParseUUIDPipe) batchId: string,
  ) {
    return this.business.approveBulkPayout(user.userId, orgId, batchId);
  }

  @Get('organizations/:orgId/bulk-payouts/:batchId')
  @ApiOperation({ summary: 'Get bulk payout batch details' })
  getBatch(
    @CurrentUser() user: AuthUser,
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('batchId', ParseUUIDPipe) batchId: string,
  ) {
    return this.business.getBatch(user.userId, orgId, batchId);
  }
}
