import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsNumber, IsString, Matches, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { FeesService } from './fees.service';
import type { FeeTransactionType } from './fees.types';

class FeeQuoteQueryDto {
  @IsString()
  @IsIn(['fund', 'payout', 'card_spend', 'card_issue', 'bill', 'airtime'])
  type!: FeeTransactionType;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amountMajor!: number;

  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency!: string;
}

@ApiTags('fees')
@Controller('v1/fees')
export class FeesController {
  constructor(private readonly fees: FeesService) {}

  @Get('quote')
  @ApiOperation({
    summary: 'Quote transaction fee before fund/payout/card/bill',
  })
  quote(@Query() query: FeeQuoteQueryDto) {
    return this.fees.quoteFromMajor(
      query.type,
      query.amountMajor,
      query.currency.toUpperCase(),
    );
  }
}
