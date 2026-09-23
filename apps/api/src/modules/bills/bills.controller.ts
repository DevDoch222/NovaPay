import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { BillsService } from './bills.service';
import { AirtimeTopupDto, PayBillDto } from './dto';
import { CurrentUser, type AuthUser } from '../../common/decorators';

@Controller('v1')
export class BillsController {
  constructor(private readonly bills: BillsService) {}

  @Get('bills/catalog')
  catalog(@Query('country') country?: string) {
    return this.bills.listBillers(country?.toUpperCase());
  }

  @Get('airtime/operators')
  operators(@Query('country') country?: string) {
    return this.bills.listAirtimeOperators(country?.toUpperCase());
  }

  @Post('bills/pay')
  pay(@CurrentUser() user: AuthUser, @Body() dto: PayBillDto) {
    return this.bills.payBill({
      userId: user.userId,
      billerId: dto.billerId,
      customerRef: dto.customerRef,
      amountMajor: dto.amountMajor,
      idempotencyKey: dto.idempotencyKey,
    });
  }

  @Post('airtime/topup')
  airtime(@CurrentUser() user: AuthUser, @Body() dto: AirtimeTopupDto) {
    return this.bills.topupAirtime({
      userId: user.userId,
      operatorId: dto.operatorId,
      phone: dto.phone,
      amountMajor: dto.amountMajor,
      idempotencyKey: dto.idempotencyKey,
    });
  }
}
