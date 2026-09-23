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
import { ReceiveService } from './receive.service';
import { CreateVirtualAccountDto, SimulateInboundDto } from './dto';
import { CurrentUser, Public, type AuthUser } from '../../common/decorators';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

@ApiTags('receive')
@Controller('v1')
export class ReceiveController {
  constructor(private readonly receive: ReceiveService) {}

  @Post('accounts/virtual')
  @ApiOperation({ summary: 'Create virtual receiving account' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateVirtualAccountDto) {
    return this.receive.createVirtualAccount(user.userId, dto.currency);
  }

  @Get('accounts/virtual')
  @ApiOperation({ summary: 'List virtual accounts (paginated)' })
  list(@CurrentUser() user: AuthUser, @Query() query: PaginationQueryDto) {
    return this.receive.listVirtualAccounts(
      user.userId,
      query.page,
      query.limit,
    );
  }

  @Post('accounts/virtual/:id/simulate-inbound')
  @ApiOperation({ summary: 'Simulate inbound ACH/SEPA credit (sandbox)' })
  async simulateInbound(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SimulateInboundDto,
  ) {
    const va = await this.receive.getOwnedVirtualAccount(user.userId, id);
    return this.receive.creditInbound({
      providerRef: va.providerRef,
      amountMajor: dto.amountMajor,
      currency: dto.currency,
      externalReference: dto.externalReference,
      senderName: dto.senderName ?? 'Sandbox Sender LLC',
    });
  }

  @Public()
  @Post('accounts/baas/webhook')
  @ApiOperation({ summary: 'BaaS inbound credit webhook' })
  baasWebhook(
    @Body()
    body: {
      providerRef?: string;
      accountNumber?: string;
      amountMajor: number;
      currency: string;
      externalReference: string;
      senderName?: string;
    },
  ) {
    return this.receive.creditInbound(body);
  }
}
