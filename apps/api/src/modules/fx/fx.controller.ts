import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Body,
  Query,
} from '@nestjs/common';
import { FxService } from './fx.service';
import { BookFxQuoteDto, CreateFxQuoteDto } from './dto';
import { CurrentUser, type AuthUser } from '../../common/decorators';

@Controller('v1/fx')
export class FxController {
  constructor(private readonly fx: FxService) {}

  @Get('rate')
  rate(@Query('source') source = 'NGN', @Query('dest') dest = 'USD') {
    return this.fx.getRate(source.toUpperCase(), dest.toUpperCase());
  }

  @Post('quotes')
  createQuote(@CurrentUser() user: AuthUser, @Body() dto: CreateFxQuoteDto) {
    return this.fx.createQuote({
      userId: user.userId,
      sourceCurrency: dto.sourceCurrency.toUpperCase(),
      destCurrency: dto.destCurrency.toUpperCase(),
      sourceAmountMajor: dto.sourceAmountMajor,
    });
  }

  @Post('quotes/:id/book')
  book(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BookFxQuoteDto,
  ) {
    return this.fx.bookQuote(user.userId, id, dto.idempotencyKey);
  }
}
