import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CreateBeneficiaryDto, CreatePayoutDto, FundWalletDto } from './dto';
import { CurrentUser, Public, type AuthUser } from '../../common/decorators';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

@ApiTags('payments')
@Controller('v1')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('payments/rail')
  rail() {
    return { rail: this.payments.getRailName() };
  }

  @Get('payments/banks/ng')
  listNgBanks() {
    return this.payments.listNgBanks();
  }

  @Post('beneficiaries')
  createBeneficiary(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateBeneficiaryDto,
  ) {
    return this.payments.createBeneficiary(user.userId, dto);
  }

  @Get('beneficiaries')
  @ApiOperation({ summary: 'List beneficiaries (paginated)' })
  listBeneficiaries(
    @CurrentUser() user: AuthUser,
    @Query() query: PaginationQueryDto,
  ) {
    return this.payments.listBeneficiaries(
      user.userId,
      query.page,
      query.limit,
    );
  }

  @Post('payments/fund')
  fund(@CurrentUser() user: AuthUser, @Body() dto: FundWalletDto) {
    return this.payments.fundWallet(user.userId, dto);
  }

  @Post('payments/fund/:id/simulate-complete')
  simulateFund(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.payments.simulateFundComplete(user.userId, id);
  }

  @Post('payments/payout')
  payout(@CurrentUser() user: AuthUser, @Body() dto: CreatePayoutDto) {
    return this.payments.payout(user.userId, dto);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'List transactions (paginated)' })
  listTransactions(
    @CurrentUser() user: AuthUser,
    @Query() query: PaginationQueryDto,
  ) {
    return this.payments.listTransactions(user.userId, query.page, query.limit);
  }

  @Get('transactions/:id')
  getTransaction(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.payments.getTransaction(user.userId, id);
  }

  @Public()
  @Post('payments/flutterwave/webhook')
  flutterwaveWebhook(
    @Body() body: Record<string, unknown>,
    @Headers('verif-hash') verifHash?: string,
  ) {
    return this.payments.handleFlutterwaveWebhook(body, verifHash);
  }

  @Public()
  @Get('payments/flutterwave/return')
  flutterwaveReturn(
    @Query('tx_ref') txRef?: string,
    @Query('status') status?: string,
  ) {
    return {
      message:
        'Payment return received. Wallet credit is confirmed via webhook.',
      txRef: txRef ?? null,
      status: status ?? null,
    };
  }
}
